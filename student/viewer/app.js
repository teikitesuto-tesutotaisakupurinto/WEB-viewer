
import {
  requireBookAccess
} from "../../assets/js/auth.js";

import {
  supabase
} from "../../assets/js/supabase.js";


/* =========================================================
   URL
   ========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

const bookId =
  params.get("book");


if (!bookId) {

  window.location.replace(
    "/errors/?type=404"
  );

  throw new Error(
    "BOOK_ID_MISSING"
  );

}


/* =========================================================
   DOM
   ========================================================= */

const titleElement =
  document.getElementById("title");

const pageElement =
  document.getElementById("page");

const stage =
  document.getElementById("stage");

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

const viewerMessage =
  document.getElementById(
    "viewerMessage"
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

const moveButton =
  document.getElementById(
    "move"
  );


/* =========================================================
   State
   ========================================================= */

let student = null;

let book = null;

let pdf = null;

let pdfjs = null;

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

let renderToken = 0;

let pageChanging = false;

const imageCache =
  new Map();


/* =========================================================
   Message
   ========================================================= */

function showMessage(
  text
) {

  if (!viewerMessage) {
    return;
  }


  viewerMessage.textContent =
    text;


  viewerMessage.classList.remove(
    "hidden"
  );

}


function hideMessage() {

  if (!viewerMessage) {
    return;
  }


  viewerMessage.textContent =
    "";


  viewerMessage.classList.add(
    "hidden"
  );

}


/* =========================================================
   Storage
   ========================================================= */

async function getSignedUrl(
  path
) {

  if (!path) {

    throw new Error(
      "教材ファイルが登録されていません。"
    );

  }


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


  if (error) {

    console.error(
      "STORAGE URL ERROR:",
      error
    );

    throw new Error(
      "教材ファイルを取得できませんでした。"
    );

  }


  if (
    !data?.signedUrl
  ) {

    throw new Error(
      "教材ファイルのURLを取得できませんでした。"
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

    console.error(
      "BOOK LOAD ERROR:",
      error
    );

    throw new Error(
      "Bookを取得できませんでした。"
    );

  }


  if (!data) {

    window.location.replace(
      "/errors/?type=404"
    );

    return false;

  }


  if (
    data.enabled === false
  ) {

    window.location.replace(
      "/errors/?type=book-forbidden"
    );

    return false;

  }


  book =
    data;


  if (titleElement) {

    titleElement.textContent =
      book.title || "";

  }


  return true;

}


/* =========================================================
   PDF判定
   ========================================================= */

function isPdfBook() {

  const type =
    String(
      book?.file_type || ""
    )
      .trim()
      .toLowerCase();


  return (
    type === "pdf" ||
    /\.pdf$/i.test(
      book?.file_path || ""
    )
  );

}


/* =========================================================
   PDF.js ローカル読み込み
   ========================================================= */

async function loadPdfJs() {

  if (pdfjs) {
    return pdfjs;
  }


  /*
   * 外部CDNは使用しない。
   *
   * プロジェクト内:
   *
   * assets/pdfjs/pdf.mjs
   * assets/pdfjs/pdf.worker.mjs
   */

  try {

    pdfjs =
      await import(
        "../../assets/pdfjs/pdf.mjs"
      );

  }
  catch (error) {

    console.error(
      "PDF.JS LOAD ERROR:",
      error
    );

    throw new Error(
      "PDF表示機能を読み込めませんでした。"
    );

  }


  if (
    typeof pdfjs.getDocument !==
    "function"
  ) {

    throw new Error(
      "PDF表示機能が正しく構成されていません。"
    );

  }


  /*
   * Workerもプロジェクト内。
   */

  pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
      "../../assets/pdfjs/pdf.worker.mjs",
      import.meta.url
    ).href;


  return pdfjs;

}


/* =========================================================
   PDF読み込み
   ========================================================= */

async function loadPdf() {

  if (!book?.file_path) {

    throw new Error(
      "PDFファイルが登録されていません。"
    );

  }


  showMessage(
    "PDFを読み込んでいます。"
  );


  const library =
    await loadPdfJs();


  const url =
    await getSignedUrl(
      book.file_path
    );


  let loadingTask;


  try {

    loadingTask =
      library.getDocument({

        url,

        withCredentials:
          false

      });


    pdf =
      await loadingTask.promise;

  }
  catch (error) {

    console.error(
      "PDF DOCUMENT ERROR:",
      error
    );

    throw new Error(
      "PDFを読み込めませんでした。"
    );

  }


  if (
    !pdf ||
    !pdf.numPages
  ) {

    throw new Error(
      "PDFにページがありません。"
    );

  }


  hideMessage();

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

    console.error(
      "BOOK PAGES ERROR:",
      error
    );

    throw new Error(
      "教材ページを取得できませんでした。"
    );

  }


  pages =
    (data || [])
      .filter(
        row =>
          row &&
          row.file_path
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
      "このBookには表示できるページがありません。"
    );

  }

}


/* =========================================================
   ページ数
   ========================================================= */

function getPageCount() {

  if (pdf) {

    return pdf.numPages;

  }


  return pages.length;

}


function updatePageLabel() {

  if (!pageElement) {
    return;
  }


  pageElement.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   Annotation Canvas
   ========================================================= */

function resizeAnnotationCanvas(
  width,
  height
) {

  annotationCanvas.width =
    Math.max(
      1,
      Math.floor(width)
    );


  annotationCanvas.height =
    Math.max(
      1,
      Math.floor(height)
    );


  annotationCanvas.style.width =
    `${width}px`;


  annotationCanvas.style.height =
    `${height}px`;

}


/* =========================================================
   PDFページ描画
   ========================================================= */

async function renderPdfPage() {

  const token =
    ++renderToken;


  const page =
    await pdf.getPage(
      currentPage
    );


  if (
    token !== renderToken
  ) {

    return;

  }


  const viewport =
    page.getViewport({
      scale:
        zoom
    });


  const width =
    Math.max(
      1,
      Math.floor(
        viewport.width
      )
    );


  const height =
    Math.max(
      1,
      Math.floor(
        viewport.height
      )
    );


  pdfCanvas.width =
    width;


  pdfCanvas.height =
    height;


  pdfCanvas.style.width =
    `${width}px`;


  pdfCanvas.style.height =
    `${height}px`;


  pdfCanvas.style.display =
    "block";


  imagePage.style.display =
    "none";


  pageContainer.style.width =
    `${width}px`;


  pageContainer.style.height =
    `${height}px`;


  resizeAnnotationCanvas(
    width,
    height
  );


  const context =
    pdfCanvas.getContext(
      "2d",
      {
        alpha: false
      }
    );


  context.fillStyle =
    "#ffffff";


  context.fillRect(
    0,
    0,
    width,
    height
  );


  await page.render({

    canvasContext:
      context,

    viewport,

    intent:
      "display"

  }).promise;


  if (
    token !== renderToken
  ) {

    return;

  }


  updatePageLabel();


  await loadAnnotation();

}


/* =========================================================
   画像取得
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
    await getSignedUrl(
      page.file_path
    );


  const image =
    new Image();


  image.decoding =
    "async";


  image.src =
    url;


  await new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        image.complete &&
        image.naturalWidth > 0
      ) {

        resolve();

        return;

      }


      image.onload =
        () =>
          resolve();


      image.onerror =
        () =>
          reject(
            new Error(
              "ページ画像を読み込めませんでした。"
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
   画像ページ描画
   ========================================================= */

async function renderImagePage() {

  const token =
    ++renderToken;


  const image =
    await getImage(
      currentPage
    );


  if (
    token !== renderToken
  ) {

    return;

  }


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


  resizeAnnotationCanvas(
    width,
    height
  );


  updatePageLabel();


  await loadAnnotation();


  if (
    token !== renderToken
  ) {

    return;

  }


  /*
   * 次ページ・前ページを先読み。
   */

  void preloadImage(
    currentPage + 1
  );


  void preloadImage(
    currentPage - 1
  );

}


async function preloadImage(
  pageNumber
) {

  if (
    pageNumber < 1 ||
    pageNumber > pages.length
  ) {

    return;

  }


  try {

    await getImage(
      pageNumber
    );

  }
  catch (
    error
  ) {

    console.warn(
      "IMAGE PRELOAD ERROR:",
      error
    );

  }

}


/* =========================================================
   Render
   ========================================================= */

async function renderPage() {

  if (pdf) {

    await renderPdfPage();

    return;

  }


  await renderImagePage();

}


/* =========================================================
   ページ移動
   ========================================================= */

async function changePage(
  target
) {

  if (
    pageChanging
  ) {

    return;

  }


  const total =
    getPageCount();


  if (
    target < 1 ||
    target > total
  ) {

    return;

  }


  if (
    target === currentPage
  ) {

    return;

  }


  pageChanging =
    true;


  try {

    await saveAnnotation();


    currentPage =
      target;


    await renderPage();

  }
  finally {

    pageChanging =
      false;

  }

}


async function nextPage() {

  await changePage(
    currentPage + 1
  );

}


async function previousPage() {

  await changePage(
    currentPage - 1
  );

}


async function firstPage() {

  await changePage(
    1
  );

}


async function lastPage() {

  await changePage(
    getPageCount()
  );

}


/* =========================================================
   Page Buttons
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

  const nextZoom =
    Number(
      value
    );


  if (
    !Number.isFinite(
      nextZoom
    )
  ) {

    return;

  }


  zoom =
    Math.max(
      0.25,
      Math.min(
        5,
        nextZoom
      )
    );


  await renderPage();

}


document.getElementById(
  "zoomIn"
).onclick =
  () =>
    setZoom(
      zoom + 0.1
    );


document.getElementById(
  "zoomOut"
).onclick =
  () =>
    setZoom(
      zoom - 0.1
    );


/* =========================================================
   Fit Width
   ========================================================= */

document.getElementById(
  "fitWidth"
).onclick =
  async () => {

    let naturalWidth;


    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      naturalWidth =
        page
          .getViewport({
            scale: 1
          })
          .width;

    }
    else {

      const image =
        await getImage(
          currentPage
        );


      naturalWidth =
        image.naturalWidth;

    }


    const availableWidth =
      Math.max(
        100,
        stage.clientWidth - 56
      );


    await setZoom(
      availableWidth /
      naturalWidth
    );

  };


/* =========================================================
   Fit Height
   ========================================================= */

document.getElementById(
  "fitHeight"
).onclick =
  async () => {

    let naturalHeight;


    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      naturalHeight =
        page
          .getViewport({
            scale: 1
          })
          .height;

    }
    else {

      const image =
        await getImage(
          currentPage
        );


      naturalHeight =
        image.naturalHeight;

    }


    const availableHeight =
      Math.max(
        100,
        stage.clientHeight - 56
      );


    await setZoom(
      availableHeight /
      naturalHeight
    );

  };


/* =========================================================
   Fullscreen
   ========================================================= */

document.getElementById(
  "fullscreen"
).onclick =
  async () => {

    try {

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
    catch (
      error
    ) {

      console.warn(
        "FULLSCREEN ERROR:",
        error
      );

    }

  };


/* =========================================================
   Mode
   ========================================================= */

function updateMode() {

  moveButton.classList.toggle(
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
  nextMode
) {

  mode =
    nextMode;


  drawing =
    false;


  updateMode();

}


moveButton.onclick =
  () =>
    setMode(
      "move"
    );


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
    setMode(
      "eraser"
    );


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
   Mobile Menu
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
      String(
        !open
      )
    );


    menuButton.setAttribute(
      "aria-expanded",
      String(
        open
      )
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
          else if (
            action === "previous"
          ) {

            await previousPage();

          }
          else if (
            action === "next"
          ) {

            await nextPage();

          }
          else if (
            action === "last"
          ) {

            await lastPage();

          }
          else if (
            action === "move"
          ) {

            setMode(
              "move"
            );

          }
          else if (
            action === "pen"
          ) {

            setMode(
              "pen"
            );

          }
          else if (
            action === "eraser"
          ) {

            setMode(
              "eraser"
            );

          }
          else if (
            action === "favorite"
          ) {

            document
              .getElementById(
                "favorite"
              )
              .click();

          }
          else if (
            action === "zoomIn"
          ) {

            await setZoom(
              zoom + 0.1
            );

          }
          else if (
            action === "zoomOut"
          ) {

            await setZoom(
              zoom - 0.1
            );

          }
          else if (
            action === "fitWidth"
          ) {

            await document
              .getElementById(
                "fitWidth"
              )
              .click();

          }
          else if (
            action === "fitHeight"
          ) {

            await document
              .getElementById(
                "fitHeight"
              )
              .click();

          }
          else if (
            action === "fullscreen"
          ) {

            await document
              .getElementById(
                "fullscreen"
              )
              .click();

          }


          closeMenu();

        };

    }
  );


/* =========================================================
   Swipe / Pinch
   ========================================================= */

stage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length === 2
    ) {

      const first =
        event.touches[0];

      const second =
        event.touches[1];


      pinchDistance =
        Math.hypot(

          second.clientX -
          first.clientX,

          second.clientY -
          first.clientY

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
    passive: true
  }
);


stage.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length !== 2 ||
      pinchDistance === null
    ) {

      return;

    }


    event.preventDefault();


    const first =
      event.touches[0];

    const second =
      event.touches[1];


    const distance =
      Math.hypot(

        second.clientX -
        first.clientX,

        second.clientY -
        first.clientY

      );


    zoom =
      Math.max(
        0.25,
        Math.min(
          5,
          pinchStartZoom *
          distance /
          pinchDistance
        )
      );


    clearTimeout(
      window.__viewerPinchTimer
    );


    window.__viewerPinchTimer =
      setTimeout(
        () =>
          renderPage(),
        80
      );

  },
  {
    passive: false
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
      Math.abs(dx) < 70
    ) {

      return;

    }


    if (
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
   Ctrl + Wheel Zoom
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
          ? -0.1
          : 0.1
      )
    );

  },
  {
    passive: false
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


annotationCanvas.addEventListener(
  "pointercancel",
  () => {

    drawing =
      false;

  }
);


/* =========================================================
   Annotation 保存
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
      "ANNOTATION SAVE ERROR:",
      error
    );

  }

}


/* =========================================================
   Annotation 読み込み
   ========================================================= */

async function loadAnnotation() {

  const {
    data,
    error
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


  if (error) {

    console.warn(
      "ANNOTATION LOAD ERROR:",
      error
    );

  }


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


  const source =
    data?.annotation_data?.image;


  if (!source) {

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
    source;

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


    window.location.replace(
      "../books/"
    );

  };


/* =========================================================
   Start
   ========================================================= */

async function start() {

  hideMessage();


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


  /*
   * Book
   */

  const loaded =
    await loadBook();


  if (!loaded) {

    return;

  }


  /*
   * PDF / 画像
   */

  if (
    isPdfBook()
  ) {

    await loadPdf();

  }
  else {

    await loadImagePages();

  }


  /*
   * 最初のページ
   */

  currentPage =
    1;


  updatePageLabel();


  updateMode();


  await renderPage();

}


start()
  .catch(
    error => {

      console.error(
        "VIEWER ERROR:",
        error
      );


      /*
       * ここでは勝手に
       * 404やsystem errorへ飛ばさない。
       */

      showMessage(
        error.message ||
        "教材を表示できませんでした。"
      );

    }
  );
