import {
  requireBookAccess
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


/* =========================================================
   URL
   ========================================================= */

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
  document.getElementById(
    "title"
  );

const pageLabel =
  document.getElementById(
    "page"
  );

const stage =
  document.getElementById(
    "stage"
  );

const pageContainer =
  document.getElementById(
    "pageContainer"
  );

const pdfCanvas =
  document.getElementById(
    "pdfCanvas"
  );

const imagePage =
  document.getElementById(
    "imagePage"
  );

const annotationCanvas =
  document.getElementById(
    "annotationCanvas"
  );

const penButton =
  document.getElementById(
    "pen"
  );

const menuButton =
  document.getElementById(
    "menuButton"
  );

const mobileMenu =
  document.getElementById(
    "mobileMenu"
  );


/* =========================================================
   State
   ========================================================= */

let student = null;

let book = null;

let pdf = null;

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

let pinchStartZoom = 1;

const imageCache =
  new Map();


/* =========================================================
   Storage
   ========================================================= */

async function signedUrl(
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
   PDF.js LOCAL
   ========================================================= */

async function loadPdf() {

  if (!book.file_path) {

    throw new Error(
      "PDFファイルが登録されていません。"
    );

  }


  /*
   * 外部CDNではない。
   *
   * プロジェクト内:
   * assets/pdfjs/pdf.min.mjs
   */

  const pdfjs =
    await import(
      "../../assets/pdfjs/pdf.min.mjs"
    );


  pdfjs.GlobalWorkerOptions.workerSrc =
    "../../assets/pdfjs/pdf.worker.min.mjs";


  const url =
    await signedUrl(
      book.file_path
    );


  pdf =
    await pdfjs
      .getDocument({
        url
      })
      .promise;


  if (
    !pdf.numPages
  ) {

    throw new Error(
      "PDFにページがありません。"
    );

  }

}


/* =========================================================
   Images
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
        ascending:
          true
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
          Number(
            a.page_number
          ) -
          Number(
            b.page_number
          )
      );


  if (!pages.length) {

    throw new Error(
      "このBookにはページがありません。"
    );

  }

}


/* =========================================================
   Page count
   ========================================================= */

function getPageCount() {

  if (pdf) {

    return pdf.numPages;

  }


  return pages.length;

}


function updatePageLabel() {

  pageLabel.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   PDF render
   ========================================================= */

async function renderPdf() {

  const page =
    await pdf.getPage(
      currentPage
    );


  const viewport =
    page.getViewport({
      scale:
        zoom
    });


  pdfCanvas.width =
    Math.floor(
      viewport.width
    );


  pdfCanvas.height =
    Math.floor(
      viewport.height
    );


  pdfCanvas.style.width =
    `${viewport.width}px`;


  pdfCanvas.style.height =
    `${viewport.height}px`;


  pdfCanvas.style.display =
    "block";


  imagePage.style.display =
    "none";


  pageContainer.style.width =
    `${viewport.width}px`;


  pageContainer.style.height =
    `${viewport.height}px`;


  const context =
    pdfCanvas.getContext(
      "2d"
    );


  context.clearRect(
    0,
    0,
    pdfCanvas.width,
    pdfCanvas.height
  );


  await page.render({

    canvasContext:
      context,

    viewport

  }).promise;


  annotationCanvas.width =
    Math.floor(
      viewport.width
    );


  annotationCanvas.height =
    Math.floor(
      viewport.height
    );


  annotationCanvas.style.width =
    `${viewport.width}px`;


  annotationCanvas.style.height =
    `${viewport.height}px`;


  updatePageLabel();


  await loadAnnotation();


  /*
   * 次ページを軽く先読み
   */

  if (
    currentPage <
    pdf.numPages
  ) {

    pdf.getPage(
      currentPage + 1
    ).catch(
      () => {}
    );

  }

}


/* =========================================================
   Image cache
   ========================================================= */

async function getImage(
  pageNumber
) {

  if (
    imageCache.has(
      pageNumber
    )
  ) {

    return imageCache.get(
      pageNumber
    );

  }


  const page =
    pages[
      pageNumber - 1
    ];


  if (!page) {

    throw new Error(
      "ページが見つかりません。"
    );

  }


  const url =
    await signedUrl(
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
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );

    }
  );


  imageCache.set(
    pageNumber,
    image
  );


  return image;

}


/* =========================================================
   Image render
   ========================================================= */

async function renderImage() {

  const image =
    await getImage(
      currentPage
    );


  const width =
    Math.max(
      1,
      Math.round(
        image.naturalWidth *
        zoom
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        image.naturalHeight *
        zoom
      )
    );


  imagePage.src =
    image.src;


  imagePage.style.display =
    "block";


  imagePage.style.width =
    `${width}px`;


  imagePage.style.height =
    `${height}px`;


  pdfCanvas.style.display =
    "none";


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


  updatePageLabel();


  await loadAnnotation();


  preloadImage(
    currentPage + 1
  );


  preloadImage(
    currentPage - 1
  );

}


async function preloadImage(
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
   Render
   ========================================================= */

async function render() {

  if (pdf) {

    await renderPdf();

  }
  else {

    await renderImage();

  }

}


/* =========================================================
   Page navigation
   ========================================================= */

async function nextPage() {

  if (
    currentPage >=
    getPageCount()
  ) {

    return;

  }


  await saveAnnotation();


  currentPage++;


  await render();

}


async function previousPage() {

  if (
    currentPage <= 1
  ) {

    return;

  }


  await saveAnnotation();


  currentPage--;


  await render();

}


async function firstPage() {

  if (
    currentPage === 1
  ) {

    return;

  }


  await saveAnnotation();


  currentPage =
    1;


  await render();

}


async function lastPage() {

  const last =
    getPageCount();


  if (
    currentPage === last
  ) {

    return;

  }


  await saveAnnotation();


  currentPage =
    last;


  await render();

}


/* =========================================================
   Controls
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
        Number(
          value
        )
      )
    );


  await render();

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
      pdf
        ? null
        : await getImage(
            currentPage
          );


    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      const viewport =
        page.getViewport({
          scale: 1
        });


      await setZoom(
        (
          stage.clientWidth - 56
        ) /
        viewport.width
      );


      return;

    }


    await setZoom(
      (
        stage.clientWidth - 56
      ) /
      image.naturalWidth
    );

  };


document.getElementById(
  "fitHeight"
).onclick =
  async () => {

    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      const viewport =
        page.getViewport({
          scale: 1
        });


      await setZoom(
        (
          stage.clientHeight - 56
        ) /
        viewport.height
      );


      return;

    }


    const image =
      await getImage(
        currentPage
      );


    await setZoom(
      (
        stage.clientHeight - 56
      ) /
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

    }
    else {

      await document.documentElement
        .requestFullscreen();

    }

  };


/* =========================================================
   Mode
   ========================================================= */

function updateMode() {

  const move =
    document.getElementById(
      "move"
    );


  move.classList.toggle(
    "active",
    mode === "move"
  );


  penButton.classList.toggle(
    "active",
    mode === "pen"
  );


  penButton.textContent =
    mode === "pen"
      ? "ペン ON"
      : "ペン OFF";


  document.body.classList.toggle(
    "pen-enabled",
    mode === "pen"
  );

}


function setMode(
  value
) {

  mode =
    value;

  updateMode();

}


document.getElementById(
  "move"
).onclick =
  () =>
    setMode("move");


penButton.onclick =
  () =>
    setMode(
      mode === "pen"
        ? "move"
        : "pen"
    );


document.getElementById(
  "eraser"
).onclick =
  () =>
    setMode("eraser");


/* =========================================================
   Favorite
   ========================================================= */

document.getElementById(
  "favorite"
).onclick =
  event => {

    event.currentTarget.classList.toggle(
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
          )
            await firstPage();


          if (
            action === "previous"
          )
            await previousPage();


          if (
            action === "next"
          )
            await nextPage();


          if (
            action === "last"
          )
            await lastPage();


          if (
            action === "move"
          )
            setMode("move");


          if (
            action === "pen"
          )
            setMode("pen");


          if (
            action === "eraser"
          )
            setMode("eraser");


          if (
            action === "zoomIn"
          )
            await setZoom(
              zoom + .1
            );


          if (
            action === "zoomOut"
          )
            await setZoom(
              zoom - .1
            );


          if (
            action === "fitWidth"
          )
            await document.getElementById(
              "fitWidth"
            ).click();


          if (
            action === "fitHeight"
          )
            await document.getElementById(
              "fitHeight"
            ).click();


          if (
            action === "fullscreen"
          )
            await document.getElementById(
              "fullscreen"
            ).click();


          if (
            action === "favorite"
          )
            document.getElementById(
              "favorite"
            ).click();


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
          b.clientX -
          a.clientX,

          b.clientY -
          a.clientY
        );


      pinchStartZoom =
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
    passive:
      true
  }
);


stage.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length === 2 &&
      pinchDistance !== null
    ) {

      event.preventDefault();


      const a =
        event.touches[0];

      const b =
        event.touches[1];


      const distance =
        Math.hypot(
          b.clientX -
          a.clientX,

          b.clientY -
          a.clientY
        );


      zoom =
        Math.max(
          .25,
          Math.min(
            5,
            pinchStartZoom *
            distance /
            pinchDistance
          )
        );


      clearTimeout(
        window.__zoomTimer
      );


      window.__zoomTimer =
        setTimeout(
          () => {

            render();

          },
          80
        );

    }

  },
  {
    passive:
      false
  }
);


stage.addEventListener(
  "touchend",
  async event => {

    if (
      pinchDistance !== null
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
   Wheel zoom
   Ctrl + Wheel
   ========================================================= */

stage.addEventListener(
  "wheel",
  event => {

    if (
      !event.ctrlKey
    ) {

      return;

    }


    event.preventDefault();


    setZoom(
      zoom +
      (
        event.deltaY > 0
          ? -.1
          : .1
      )
    );

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Pen
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
      annotationCanvas
        .getBoundingClientRect();


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

    if (!drawing) {
      return;
    }


    const rect =
      annotationCanvas
        .getBoundingClientRect();


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
      annotationCanvas
        .getContext(
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

  if (
    !annotationCanvas.width ||
    !annotationCanvas.height
  ) {

    return;

  }


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
    annotationCanvas
      .getContext(
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
   Close
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
   Start
   ========================================================= */

async function start() {

  /*
   * Student + Book所有権限
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


  const type =
    String(
      book.file_type || ""
    ).toLowerCase();


  /*
   * PDF
   */

  if (
    type === "pdf"
  ) {

    await loadPdf();

  }


  /*
   * 画像Book
   */

  else {

    await loadImagePages();

  }


  currentPage =
    1;


  updateMode();


  await render();

}


start()
.catch(
  error => {

    console.error(
      "VIEWER ERROR:",
      error
    );


    /*
     * 内部エラーの詳細を
     * 生徒に表示しない。
     */

    location.replace(
      "/errors/?type=system"
    );

  }
);
