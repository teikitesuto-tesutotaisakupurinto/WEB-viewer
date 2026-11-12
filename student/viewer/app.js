
import {
  requireBookAccess
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


const params =
  new URLSearchParams(
    location.search
  );


const bookId =
  params.get("book");


if (!bookId) {

  location.replace(
    "/errors/?type=404"
  );

  throw new Error(
    "Book ID missing"
  );
}


/* =========================================================
   DOM
   ========================================================= */

const title =
  document.getElementById("title");

const pageLabel =
  document.getElementById("page");

const stage =
  document.getElementById("stage");

const pageContainer =
  document.getElementById(
    "pageContainer"
  );

const imagePage =
  document.getElementById(
    "imagePage"
  );

const pdfFrame =
  document.getElementById(
    "pdfFrame"
  );

const annotationCanvas =
  document.getElementById(
    "annotationCanvas"
  );

const menuButton =
  document.getElementById(
    "menuButton"
  );

const mobileMenu =
  document.getElementById(
    "mobileMenu"
  );

const penButton =
  document.getElementById(
    "pen"
  );


/* =========================================================
   State
   ========================================================= */

let student = null;

let book = null;

let pages = [];

let currentPage = 1;

let zoom = 1;

let mode = "move";

let drawing = false;

let lastX = 0;

let lastY = 0;

let touchStartX = null;

let touchStartY = null;

let touchStartTime = 0;

let pinchDistance = null;

let pinchZoom = 1;

const imageCache =
  new Map();


/* =========================================================
   Utility
   ========================================================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


async function getSignedUrl(
  path
) {

  const {
    data,
    error
  } =
    await supabase.storage
      .from("web-viewer")
      .createSignedUrl(
        path,
        600
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    throw new Error(
      "教材ファイルを取得できませんでした。"
    );

  }


  return data.signedUrl;

}


/* =========================================================
   Book
   ========================================================= */

async function loadBook() {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select(`
        id,
        title,
        description,
        file_path,
        file_type,
        enabled
      `)
      .eq(
        "id",
        bookId
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  if (!data) {

    location.replace(
      "/errors/?type=404"
    );

    return false;
  }


  if (!data.enabled) {

    location.replace(
      "/errors/?type=book-forbidden"
    );

    return false;
  }


  book =
    data;


  title.textContent =
    book.title || "";

  return true;
}


/* =========================================================
   画像Book
   ========================================================= */

async function loadImagePages() {

  const {
    data,
    error
  } =
    await supabase
      .from("book_pages")
      .select(`
        page_number,
        file_path,
        file_type
      `)
      .eq(
        "book_id",
        bookId
      )
      .order(
        "page_number",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  pages =
    (data || [])
      .filter(
        page =>
          page.file_path
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(a.page_number) -
          Number(b.page_number)
      );


  if (!pages.length) {

    throw new Error(
      "このBookには表示できるページがありません。"
    );

  }

}


/* =========================================================
   Page count
   ========================================================= */

function pageCount() {

  return pages.length;

}


function updatePage() {

  pageLabel.textContent =
    `${currentPage} / ${pageCount()}`;

}


/* =========================================================
   Image
   ========================================================= */

async function getImage(
  number
) {

  if (
    imageCache.has(number)
  ) {

    return imageCache.get(
      number
    );

  }


  const page =
    pages[number - 1];


  if (!page) {
    throw new Error(
      "ページが見つかりません。"
    );
  }


  const url =
    await getSignedUrl(
      page.file_path
    );


  const image =
    new Image();


  image.src =
    url;


  image.decoding =
    "async";


  await new Promise(
    (
      resolve,
      reject
    ) => {

      image.onload =
        resolve;

      image.onerror =
        reject;

    }
  );


  imageCache.set(
    number,
    image
  );


  return image;

}


/* =========================================================
   Render
   ========================================================= */

async function renderPage() {

  const image =
    await getImage(
      currentPage
    );


  const width =
    Math.round(
      image.naturalWidth *
      zoom
    );


  const height =
    Math.round(
      image.naturalHeight *
      zoom
    );


  imagePage.src =
    image.src;


  imagePage.style.display =
    "block";


  imagePage.style.width =
    `${width}px`;


  imagePage.style.height =
    `${height}px`;


  pdfFrame.hidden =
    true;


  pageContainer.style.width =
    `${width}px`;


  pageContainer.style.height =
    `${height}px`;


  annotationCanvas.width =
    width;


  annotationCanvas.height =
    height;


  annotationCanvas.style.width =
    `${width}px`;


  annotationCanvas.style.height =
    `${height}px`;


  updatePage();


  preload(
    currentPage + 1
  );


  preload(
    currentPage - 1
  );


  await loadAnnotation();

}


async function preload(
  number
) {

  if (
    number < 1 ||
    number > pages.length
  ) {
    return;
  }


  try {

    await getImage(
      number
    );

  }
  catch {}

}


/* =========================================================
   Page controls
   ========================================================= */

async function nextPage() {

  if (
    currentPage >=
    pageCount()
  ) {
    return;
  }


  await saveAnnotation();


  currentPage++;


  await renderPage();

}


async function previousPage() {

  if (
    currentPage <= 1
  ) {
    return;
  }


  await saveAnnotation();


  currentPage--;


  await renderPage();

}


async function firstPage() {

  if (
    currentPage === 1
  ) {
    return;
  }


  await saveAnnotation();


  currentPage = 1;


  await renderPage();

}


async function lastPage() {

  const last =
    pageCount();


  if (
    currentPage === last
  ) {
    return;
  }


  await saveAnnotation();


  currentPage =
    last;


  await renderPage();

}


/* =========================================================
   Buttons
   ========================================================= */

document.getElementById(
  "first"
).onclick =
  firstPage;


document.getElementById(
  "previous"
).onclick =
  previousPage;


document.getElementById(
  "next"
).onclick =
  nextPage;


document.getElementById(
  "last"
).onclick =
  lastPage;


/* =========================================================
   Zoom
   ========================================================= */

async function setZoom(
  value
) {

  zoom =
    Math.max(
      .25,
      Math.min(
        5,
        value
      )
    );


  await renderPage();

}


document.getElementById(
  "zoomIn"
).onclick =
  () =>
    setZoom(
      zoom + .1
    );


document.getElementById(
  "zoomOut"
).onclick =
  () =>
    setZoom(
      zoom - .1
    );


document.getElementById(
  "fitWidth"
).onclick =
  async () => {

    const image =
      await getImage(
        currentPage
      );


    const available =
      stage.clientWidth - 30;


    await setZoom(
      available /
      image.naturalWidth
    );

  };


document.getElementById(
  "fitHeight"
).onclick =
  async () => {

    const image =
      await getImage(
        currentPage
      );


    const available =
      stage.clientHeight - 30;


    await setZoom(
      available /
      image.naturalHeight
    );

  };


/* =========================================================
   Fullscreen
   ========================================================= */

document.getElementById(
  "fullscreen"
).onclick =
  async () => {

    if (
      document.fullscreenElement
    ) {

      await document.exitFullscreen();

      return;
    }


    await document.documentElement
      .requestFullscreen();

  };


/* =========================================================
   Mode
   ========================================================= */

function setMode(
  nextMode
) {

  mode =
    nextMode;


  penButton.textContent =
    mode === "pen"
      ? "ペン ON"
      : "ペン OFF";


  penButton.classList.toggle(
    "active",
    mode === "pen"
  );


  document.body.classList.toggle(
    "pen-enabled",
    mode === "pen"
  );

}


document.getElementById(
  "move"
).onclick =
  () => {

    setMode("move");

  };


penButton.onclick =
  () => {

    setMode(
      mode === "pen"
        ? "move"
        : "pen"
    );

  };


document.getElementById(
  "eraser"
).onclick =
  () => {

    setMode("eraser");

  };


/* =========================================================
   Favorite
   ========================================================= */

document.getElementById(
  "favorite"
).onclick =
  async () => {

    const button =
      document.getElementById(
        "favorite"
      );


    button.classList.toggle(
      "active"
    );

  };


/* =========================================================
   Mobile menu
   ========================================================= */

function closeMenu() {

  mobileMenu.classList.remove(
    "open"
  );

  mobileMenu.setAttribute(
    "aria-hidden",
    "true"
  );

  menuButton.setAttribute(
    "aria-expanded",
    "false"
  );

}


menuButton.onclick =
  () => {

    const open =
      !mobileMenu.classList.contains(
        "open"
      );


    mobileMenu.classList.toggle(
      "open",
      open
    );


    mobileMenu.setAttribute(
      "aria-hidden",
      String(!open)
    );


    menuButton.setAttribute(
      "aria-expanded",
      String(open)
    );

  };


mobileMenu
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(
    button => {

      button.onclick =
        async () => {

          const action =
            button.dataset.action;


          if (
            action === "first"
          ) {
            await firstPage();
          }

          if (
            action === "previous"
          ) {
            await previousPage();
          }

          if (
            action === "next"
          ) {
            await nextPage();
          }

          if (
            action === "last"
          ) {
            await lastPage();
          }

          if (
            action === "move"
          ) {
            setMode("move");
          }

          if (
            action === "pen"
          ) {
            setMode("pen");
          }

          if (
            action === "eraser"
          ) {
            setMode("eraser");
          }

          if (
            action === "zoomIn"
          ) {
            await setZoom(zoom + .1);
          }

          if (
            action === "zoomOut"
          ) {
            await setZoom(zoom - .1);
          }

          if (
            action === "fitWidth"
          ) {

            const image =
              await getImage(
                currentPage
              );

            await setZoom(
              (
                stage.clientWidth - 30
              ) /
              image.naturalWidth
            );

          }

          if (
            action === "fitHeight"
          ) {

            const image =
              await getImage(
                currentPage
              );

            await setZoom(
              (
                stage.clientHeight - 30
              ) /
              image.naturalHeight
            );

          }

          if (
            action === "fullscreen"
          ) {

            if (
              document.fullscreenElement
            ) {

              await document.exitFullscreen();

            }
            else {

              await document.documentElement
                .requestFullscreen();

            }

          }


          closeMenu();

        };

    }
  );


/* =========================================================
   Swipe
   ========================================================= */

stage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length === 2
    ) {

      const a =
        event.touches[0];

      const b =
        event.touches[1];


      pinchDistance =
        Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY
        );


      pinchZoom =
        zoom;


      return;
    }


    if (
      mode !== "move"
    ) {
      return;
    }


    const touch =
      event.touches[0];


    touchStartX =
      touch.clientX;

    touchStartY =
      touch.clientY;

    touchStartTime =
      Date.now();

  },
  {
    passive: true
  }
);


stage.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length === 2 &&
      pinchDistance
    ) {

      event.preventDefault();


      const a =
        event.touches[0];

      const b =
        event.touches[1];


      const distance =
        Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY
        );


      setZoom(
        pinchZoom *
        distance /
        pinchDistance
      );


    }

  },
  {
    passive: false
  }
);


stage.addEventListener(
  "touchend",
  async event => {

    if (
      pinchDistance
    ) {

      pinchDistance =
        null;

      return;
    }


    if (
      mode !== "move" ||
      touchStartX === null
    ) {

      return;
    }


    const touch =
      event.changedTouches[0];


    const dx =
      touch.clientX -
      touchStartX;


    const dy =
      touch.clientY -
      touchStartY;


    const elapsed =
      Date.now() -
      touchStartTime;


    touchStartX =
      null;

    touchStartY =
      null;


    if (
      elapsed > 700
    ) {
      return;
    }


    if (
      Math.abs(dx) < 70 ||
      Math.abs(dx) <=
        Math.abs(dy)
    ) {

      return;
    }


    if (
      dx < 0
    ) {

      await nextPage();

    }
    else {

      await previousPage();

    }

  }
);


/* =========================================================
   Annotation
   ========================================================= */

annotationCanvas.addEventListener(
  "pointerdown",
  event => {

    if (
      mode !== "pen" &&
      mode !== "eraser"
    ) {
      return;
    }


    drawing =
      true;


    annotationCanvas.setPointerCapture(
      event.pointerId
    );


    const rect =
      annotationCanvas.getBoundingClientRect();


    lastX =
      (
        event.clientX -
        rect.left
      ) *
      annotationCanvas.width /
      rect.width;


    lastY =
      (
        event.clientY -
        rect.top
      ) *
      annotationCanvas.height /
      rect.height;

  }
);


annotationCanvas.addEventListener(
  "pointermove",
  event => {

    if (
      !drawing
    ) {
      return;
    }


    const rect =
      annotationCanvas.getBoundingClientRect();


    const x =
      (
        event.clientX -
        rect.left
      ) *
      annotationCanvas.width /
      rect.width;


    const y =
      (
        event.clientY -
        rect.top
      ) *
      annotationCanvas.height /
      rect.height;


    const context =
      annotationCanvas.getContext(
        "2d"
      );


    context.beginPath();

    context.moveTo(
      lastX,
      lastY
    );

    context.lineTo(
      x,
      y
    );

    context.lineCap =
      "round";


    if (
      mode === "eraser"
    ) {

      context.globalCompositeOperation =
        "destination-out";

      context.lineWidth =
        28;

    }
    else {

      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        "#111";

      context.lineWidth =
        3;

    }


    context.stroke();


    lastX =
      x;

    lastY =
      y;

  }
);


annotationCanvas.addEventListener(
  "pointerup",
  async () => {

    if (!drawing) {
      return;
    }


    drawing =
      false;


    await saveAnnotation();

  }
);


/* =========================================================
   Annotation
   ========================================================= */

async function saveAnnotation() {

  const image =
    annotationCanvas.toDataURL(
      "image/png"
    );


  const {
    error
  } =
    await supabase
      .from("annotations")
      .upsert(

        {

          student_id:
            student.id,

          book_id:
            bookId,

          page_number:
            currentPage,

          annotation_data:
            {
              image
            },

          updated_at:
            new Date()
              .toISOString()

        },

        {
          onConflict:
            "student_id,book_id,page_number"
        }

      );


  if (error) {

    console.warn(
      "ANNOTATION SAVE:",
      error
    );

  }

}


async function loadAnnotation() {

  const {
    data
  } =
    await supabase
      .from("annotations")
      .select(
        "annotation_data"
      )
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "book_id",
        bookId
      )
      .eq(
        "page_number",
        currentPage
      )
      .maybeSingle();


  const context =
    annotationCanvas.getContext(
      "2d"
    );


  context.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );


  const src =
    data?.annotation_data?.image;


  if (!src) {
    return;
  }


  const image =
    new Image();


  image.onload =
    () => {

      context.drawImage(
        image,
        0,
        0,
        annotationCanvas.width,
        annotationCanvas.height
      );

    };


  image.src =
    src;

}


/* =========================================================
   戻る
   ========================================================= */

document.getElementById(
  "close"
).onclick =
  async () => {

    await saveAnnotation();


    if (
      window.opener &&
      !window.opener.closed
    ) {

      window.close();

      return;

    }


    location.replace(
      "../books/"
    );

  };


/* =========================================================
   起動
   ========================================================= */

async function start() {

  /*
   * Student + Book権限
   */

  student =
    await requireBookAccess(
      bookId
    );


  if (!student) {
    return;
  }


  const exists =
    await loadBook();


  if (!exists) {
    return;
  }


  /*
   * このViewerは画像Book専用
   */

  const type =
    String(
      book.file_type || ""
    ).toLowerCase();


  if (
    type === "pdf"
  ) {

    /*
     * PDF.jsなし。
     * ブラウザ標準PDFを表示。
     */

    const url =
      await getSignedUrl(
        book.file_path
      );


    pdfFrame.src =
      url;

    pdfFrame.hidden =
      false;

    imagePage.style.display =
      "none";

    pageLabel.textContent =
      "PDF";

    return;
  }


  await loadImagePages();


  currentPage =
    1;


  await renderPage();

}


start()
  .catch(
    error => {

      console.error(
        "VIEWER ERROR:",
        error
      );


      document.body.innerHTML = `

        <main class="viewer-error">

          <section class="viewer-error-card">

            <h2>
              教材を表示できませんでした
            </h2>

            <p>
              教材の読み込みに失敗しました。
            </p>

            <button
              type="button"
              onclick="location.replace('../books/')">

              My Booksへ戻る

            </button>

          </section>

        </main>

      `;

    }
  );
