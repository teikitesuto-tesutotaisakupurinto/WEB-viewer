
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

const currentSlide =
  document.getElementById("currentSlide");

const incomingSlide =
  document.getElementById("incomingSlide");

const currentPdfCanvas =
  document.getElementById("currentPdfCanvas");

const incomingPdfCanvas =
  document.getElementById("incomingPdfCanvas");

const currentImage =
  document.getElementById("currentImage");

const incomingImage =
  document.getElementById("incomingImage");

const annotationCanvas =
  document.getElementById("currentAnnotation");

const loadingOverlay =
  document.getElementById("loadingOverlay");

const viewerMessage =
  document.getElementById("viewerMessage");

const menuButton =
  document.getElementById("menuButton");

const mobileMenu =
  document.getElementById("mobileMenu");

const moveButton =
  document.getElementById("move");

const penButton =
  document.getElementById("pen");

const eraserButton =
  document.getElementById("eraser");

const favoriteButton =
  document.getElementById("favorite");

const zoomInButton =
  document.getElementById("zoomIn");

const zoomOutButton =
  document.getElementById("zoomOut");

const fitWidthButton =
  document.getElementById("fitWidth");

const fitHeightButton =
  document.getElementById("fitHeight");

const fullscreenButton =
  document.getElementById("fullscreen");

const firstButton =
  document.getElementById("first");

const previousButton =
  document.getElementById("previous");

const nextButton =
  document.getElementById("next");

const lastButton =
  document.getElementById("last");

const closeButton =
  document.getElementById("close");

const printButton =
  document.getElementById("print");


if (
  !stage ||
  !currentSlide ||
  !incomingSlide ||
  !currentPdfCanvas ||
  !incomingPdfCanvas ||
  !currentImage ||
  !incomingImage ||
  !annotationCanvas
) {

  throw new Error(
    "VIEWER_DOM_INCOMPLETE"
  );

}


/* =========================================================
   State
   ========================================================= */

let student = null;

let book = null;

let pdf = null;

let pdfjs = null;

let pages = [];

let currentPage = 1;

let viewerMode =
  "move";

let gestureMode =
  "idle";


/*
 * 1～8倍
 */

let zoom =
  1;

const MIN_ZOOM =
  1;

const MAX_ZOOM =
  8;


/*
 * PDF基準倍率
 */

let pdfBaseScale =
  1;


/*
 * 現在ページサイズ
 */

let pageWidth =
  0;

let pageHeight =
  0;


/*
 * 現在ページのパン
 */

let panX =
  0;

let panY =
  0;


/*
 * ページ切替
 */

let pageChanging =
  false;


/*
 * Pointer
 */

const pointers =
  new Map();


/*
 * 自由ドラッグ
 */

let dragStartX =
  0;

let dragStartY =
  0;

let dragX =
  0;

let dragY =
  0;

let dragDirection =
  0;


/*
 * 隣ページ
 */

let adjacentReady =
  false;

let adjacentPromise =
  null;


/*
 * Pinch
 */

let pinchStartDistance =
  0;

let pinchStartZoom =
  1;


/*
 * PDF render generation
 */

let renderToken =
  0;


/*
 * Image cache
 */

const imageCache =
  new Map();


/*
 * ペン
 */

let drawing =
  false;

let lastX =
  0;

let lastY =
  0;

let lastMidX =
  0;

let lastMidY =
  0;


/*
 * ペン保存用
 */

let annotationSaveTimer =
  null;

let annotationDirty =
  false;


/*
 * Desktop
 */

let mouseDown =
  false;

let mouseStartX =
  0;

let mouseStartY =
  0;

let mouseBaseX =
  0;

let mouseBaseY =
  0;


/* =========================================================
   Constants
   ========================================================= */

const PAN_ZOOM_LIMIT =
  1.03;

const PAGE_COMMIT_RATIO =
  0.28;


/*
 * PDFは最大DPR 3。
 *
 * 巨大Canvas化を防ぐ。
 */

const MAX_PDF_DPR =
  3;


/*
 * ペンは最大DPR 4。
 */

const MAX_PEN_DPR =
  4;


/*
 * ペン基本幅
 */

const PEN_WIDTH =
  2.6;


/*
 * 消しゴム幅
 */

const ERASER_WIDTH =
  26;


/* =========================================================
   Loading
   ========================================================= */

function showLoading() {

  loadingOverlay?.classList.remove(
    "hidden"
  );

  loadingOverlay?.setAttribute(
    "aria-hidden",
    "false"
  );

}


function hideLoading() {

  loadingOverlay?.classList.add(
    "hidden"
  );

  loadingOverlay?.setAttribute(
    "aria-hidden",
    "true"
  );

}


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
   Utility
   ========================================================= */

function wait(
  ms
) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
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
      "STORAGE ERROR:",
      error
    );

    throw new Error(
      "教材ファイルを取得できませんでした。"
    );

  }


  if (!data?.signedUrl) {

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
   PDF
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


async function loadPdfJs() {

  if (pdfjs) {
    return pdfjs;
  }


  pdfjs =
    await import(
      "../../assets/pdfjs/pdf.mjs"
    );


  if (
    typeof pdfjs.getDocument !==
    "function"
  ) {

    throw new Error(
      "PDF表示機能が正しく構成されていません。"
    );

  }


  pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
      "../../assets/pdfjs/pdf.worker.mjs",
      import.meta.url
    ).href;


  return pdfjs;

}


async function loadPdf() {

  showLoading();


  try {

    const library =
      await loadPdfJs();


    const url =
      await getSignedUrl(
        book.file_path
      );


    pdf =
      await library
        .getDocument({
          url,
          withCredentials:
            false
        })
        .promise;


    if (
      !pdf ||
      !pdf.numPages
    ) {

      throw new Error(
        "PDFにページがありません。"
      );

    }

  }
  finally {

    hideLoading();

  }

}


/* =========================================================
   Image Book
   ========================================================= */

async function loadImagePages() {

  showLoading();


  try {

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

      throw new Error(
        "教材ページを取得できませんでした。"
      );

    }


    pages =
      (data || [])
        .filter(
          row =>
            row?.file_path
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


    if (
      !pages.length
    ) {

      throw new Error(
        "このBookには表示できるページがありません。"
      );

    }

  }
  finally {

    hideLoading();

  }

}


/* =========================================================
   Page
   ========================================================= */

function getPageCount() {

  return pdf
    ? pdf.numPages
    : pages.length;

}


function updatePageLabel() {

  if (!pageElement) {
    return;
  }


  pageElement.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   Image
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


  const row =
    pages[
      pageNumber - 1
    ];


  if (!row) {

    throw new Error(
      "ページが見つかりません。"
    );

  }


  const url =
    await getSignedUrl(
      row.file_path
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
        resolve;


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
   PDF helpers
   ========================================================= */

function getPdfDpr() {

  return Math.min(

    MAX_PDF_DPR,

    Math.max(
      1,
      window.devicePixelRatio || 1
    )

  );

}


function getPenDpr() {

  return Math.min(

    MAX_PEN_DPR,

    Math.max(
      1,
      window.devicePixelRatio || 1
    )

  );

}


async function getPdfSize(
  pageNumber
) {

  const page =
    await pdf.getPage(
      pageNumber
    );


  const viewport =
    page.getViewport({
      scale:
        1
    });


  return {

    width:
      viewport.width,

    height:
      viewport.height

  };

}


async function getInitialPdfScale() {

  const size =
    await getPdfSize(
      currentPage
    );


  return Math.min(

    (
      stage.clientWidth -
      48
    ) /
    size.width,

    (
      stage.clientHeight -
      48
    ) /
    size.height

  );

}


/* =========================================================
   High quality PDF rendering
   ========================================================= */

async function renderPdfCanvas(
  canvas,
  pageNumber,
  cssScale
) {

  const page =
    await pdf.getPage(
      pageNumber
    );


  const dpr =
    getPdfDpr();


  const cssViewport =
    page.getViewport({

      scale:
        cssScale

    });


  const renderViewport =
    page.getViewport({

      scale:
        cssScale *
        dpr

    });


  canvas.width =
    Math.ceil(
      renderViewport.width
    );


  canvas.height =
    Math.ceil(
      renderViewport.height
    );


  canvas.style.width =
    `${cssViewport.width}px`;


  canvas.style.height =
    `${cssViewport.height}px`;


  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          false,

        desynchronized:
          true
      }
    );


  context.fillStyle =
    "#fff";


  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  await page.render({

    canvasContext:
      context,

    viewport:
      renderViewport,

    intent:
      "display"

  }).promise;


  return {

    width:
      cssViewport.width,

    height:
      cssViewport.height

  };

}


/* =========================================================
   Slide
   ========================================================= */

function setSlideSize(
  slide,
  width,
  height
) {

  slide.style.width =
    `${Math.max(
      1,
      width
    )}px`;


  slide.style.height =
    `${Math.max(
      1,
      height
    )}px`;

}


function applyViewTransform() {

  currentSlide.style.transform =
    `
      translate3d(
        calc(
          -50% +
          ${panX}px
        ),
        calc(
          -50% +
          ${panY}px
        ),
        0
      )
      scale(${zoom})
    `;

}


function applyIncomingTransform(
  x,
  y = 0
) {

  incomingSlide.style.transform =
    `
      translate3d(
        calc(
          -50% +
          ${x}px
        ),
        calc(
          -50% +
          ${y}px
        ),
        0
      )
      scale(${zoom})
    `;

}


function hideIncoming() {

  incomingSlide.style.display =
    "none";


  incomingSlide.style.transition =
    "none";


  incomingPdfCanvas.style.display =
    "none";


  incomingImage.style.display =
    "none";


  adjacentReady =
    false;

}


/* =========================================================
   Current page
   ========================================================= */

async function prepareCurrentPage() {

  const token =
    ++renderToken;


  currentPdfCanvas.style.display =
    "none";


  currentImage.style.display =
    "none";


  if (pdf) {

    pdfBaseScale =
      await getInitialPdfScale();


    if (
      token !==
      renderToken
    ) {

      return;

    }


    const size =
      await renderPdfCanvas(

        currentPdfCanvas,

        currentPage,

        pdfBaseScale

      );


    if (
      token !==
      renderToken
    ) {

      return;

    }


    pageWidth =
      size.width;


    pageHeight =
      size.height;


    zoom =
      1;


    currentPdfCanvas.style.display =
      "block";

  }
  else {

    const image =
      await getImage(
        currentPage
      );


    if (
      token !==
      renderToken
    ) {

      return;

    }


    pageWidth =
      image.naturalWidth;


    pageHeight =
      image.naturalHeight;


    const fit =
      Math.min(

        (
          stage.clientWidth -
          48
        ) /
        pageWidth,

        (
          stage.clientHeight -
          48
        ) /
        pageHeight

      );


    zoom =
      Math.min(
        1,
        Math.max(
          0.1,
          fit
        )
      );


    currentImage.src =
      image.src;


    currentImage.style.display =
      "block";

  }


  setSlideSize(

    currentSlide,

    pageWidth,
    pageHeight

  );


  resetPan();


  applyViewTransform();


  resizeAnnotationCanvas(

    pageWidth,
    pageHeight

  );


  updatePageLabel();


  await loadAnnotation();

}


/* =========================================================
   renderCurrent
   ========================================================= */

async function renderCurrent() {

  hideIncoming();


  await prepareCurrentPage();


  updatePageLabel();


  applyViewTransform();

}


/* =========================================================
   Adjacent
   ========================================================= */

async function prepareAdjacent(
  direction
) {

  if (
    adjacentPromise
  ) {

    return adjacentPromise;

  }


  const target =
    currentPage +
    direction;


  if (
    target < 1 ||
    target > getPageCount()
  ) {

    return false;

  }


  adjacentPromise =
    (async () => {

      adjacentReady =
        false;


      incomingPdfCanvas.style.display =
        "none";


      incomingImage.style.display =
        "none";


      if (pdf) {

        const size =
          await renderPdfCanvas(

            incomingPdfCanvas,

            target,

            pdfBaseScale

          );


        setSlideSize(

          incomingSlide,

          size.width,
          size.height

        );


        incomingPdfCanvas.style.display =
          "block";

      }
      else {

        const image =
          await getImage(
            target
          );


        const ratio =
          pageWidth /
          Math.max(
            1,
            currentImage.naturalWidth
          );


        setSlideSize(

          incomingSlide,

          image.naturalWidth *
            ratio,

          image.naturalHeight *
            ratio

        );


        incomingImage.src =
          image.src;


        incomingImage.style.display =
          "block";

      }


      incomingSlide.style.display =
        "flex";


      incomingSlide.style.transition =
        "none";


      const startX =
        direction > 0
          ? stage.clientWidth
          : -stage.clientWidth;


      applyIncomingTransform(
        startX,
        0
      );


      adjacentReady =
        true;


      return true;

    })()
      .catch(
        error => {

          console.error(
            "ADJACENT ERROR:",
            error
          );


          hideIncoming();


          return false;

        }
      )
      .finally(
        () => {

          adjacentPromise =
            null;

        }
      );


  return adjacentPromise;

}


/* =========================================================
   Pan
   ========================================================= */

function getPanLimits() {

  return {

    x:
      Math.max(

        0,

        (
          pageWidth *
          zoom -
          stage.clientWidth

        ) / 2

      ),

    y:
      Math.max(

        0,

        (
          pageHeight *
          zoom -
          stage.clientHeight

        ) / 2

      )

  };

}


function clampPan() {

  const limits =
    getPanLimits();


  panX =
    Math.max(
      -limits.x,
      Math.min(
        limits.x,
        panX
      )
    );


  panY =
    Math.max(
      -limits.y,
      Math.min(
        limits.y,
        panY
      )
    );

}


function resetPan() {

  panX =
    0;

  panY =
    0;

}


/* =========================================================
   Zoom
   ========================================================= */

function applyZoom(
  value,
  clientX,
  clientY
) {

  const oldZoom =
    zoom;


  const nextZoom =
    Math.max(

      MIN_ZOOM,

      Math.min(
        MAX_ZOOM,
        value
      )

    );


  if (
    oldZoom ===
    nextZoom
  ) {

    return;

  }


  const rect =
    stage.getBoundingClientRect();


  const localX =
    clientX -
    rect.left -
    rect.width / 2;


  const localY =
    clientY -
    rect.top -
    rect.height / 2;


  const ratio =
    nextZoom /
    oldZoom;


  panX =
    localX -
    (
      localX -
      panX
    ) *
    ratio;


  panY =
    localY -
    (
      localY -
      panY
    ) *
    ratio;


  zoom =
    nextZoom;


  clampPan();


  applyViewTransform();

}


/* =========================================================
   Pointer helpers
   ========================================================= */

function pointerDistance() {

  const values =
    [...pointers.values()];


  if (
    values.length <
    2
  ) {

    return 0;

  }


  return Math.hypot(

    values[1].x -
    values[0].x,

    values[1].y -
    values[0].y

  );

}


function pointerCenter() {

  const values =
    [...pointers.values()];


  if (
    values.length <
    2
  ) {

    return {

      x:
        stage.clientWidth / 2,

      y:
        stage.clientHeight / 2

    };

  }


  return {

    x:
      (
        values[0].x +
        values[1].x
      ) / 2,

    y:
      (
        values[0].y +
        values[1].y
      ) / 2

  };

}


/* =========================================================
   FREE VIEWER POINTER DOWN
   ========================================================= */

stage.addEventListener(
  "pointerdown",
  event => {

    if (
      viewerMode === "pen" ||
      viewerMode === "eraser"
    ) {

      return;

    }


    try {

      stage.setPointerCapture(
        event.pointerId
      );

    }
    catch {}


    pointers.set(

      event.pointerId,

      {

        x:
          event.clientX,

        y:
          event.clientY

      }

    );


    /*
     * 2本指
     */

    if (
      pointers.size >= 2
    ) {

      gestureMode =
        "pinch";


      dragDirection =
        0;


      hideIncoming();


      pinchStartDistance =
        pointerDistance();


      pinchStartZoom =
        zoom;


      return;

    }


    if (
      pointers.size !== 1 ||
      pageChanging
    ) {

      return;

    }


    dragStartX =
      event.clientX;


    dragStartY =
      event.clientY;


    dragX =
      0;

    dragY =
      0;

    dragDirection =
      0;


    adjacentReady =
      false;


    gestureMode =
      "drag";

  },
  {
    passive:
      false
  }
);


/* =========================================================
   FREE VIEWER POINTER MOVE
   ========================================================= */

stage.addEventListener(
  "pointermove",
  event => {

    if (
      pointers.has(
        event.pointerId
      )
    ) {

      pointers.set(

        event.pointerId,

        {

          x:
            event.clientX,

          y:
            event.clientY

        }

      );

    }


    /*
     * PINCH
     */

    if (
      gestureMode ===
        "pinch" &&
      pointers.size >= 2
    ) {

      event.preventDefault();


      const distance =
        pointerDistance();


      if (
        pinchStartDistance <= 0
      ) {

        return;

      }


      const center =
        pointerCenter();


      const rect =
        stage.getBoundingClientRect();


      applyZoom(

        pinchStartZoom *
        (
          distance /
          pinchStartDistance
        ),

        rect.left +
          center.x,

        rect.top +
          center.y

      );


      return;

    }


    /*
     * DRAG
     */

    if (
      gestureMode !==
        "drag" ||
      pointers.size !== 1
    ) {

      return;

    }


    event.preventDefault();


    dragX =
      event.clientX -
      dragStartX;


    dragY =
      event.clientY -
      dragStartY;


    /*
     * 現在ページ。
     */

    currentSlide.style.transform =
      `
        translate3d(
          calc(
            -50% +
            ${panX + dragX}px
          ),
          calc(
            -50% +
            ${panY + dragY}px
          ),
          0
        )
        scale(${zoom})
      `;


    /*
     * 横方向に動いたら
     * 隣ページ。
     */

    if (
      Math.abs(dragX) >
      8
    ) {

      const direction =
        dragX < 0
          ? 1
          : -1;


      if (
        dragDirection ===
        0
      ) {

        const target =
          currentPage +
          direction;


        if (
          target >= 1 &&
          target <=
            getPageCount()
        ) {

          dragDirection =
            direction;


          prepareAdjacent(
            direction
          );

        }

      }


      if (
        dragDirection !==
          0 &&
        direction ===
          dragDirection &&
        incomingSlide.style.display !==
          "none"
      ) {

        const startX =
          dragDirection > 0
            ? stage.clientWidth
            : -stage.clientWidth;


        applyIncomingTransform(

          startX +
          dragX,

          dragY

        );

      }

    }

  },
  {
    passive:
      false
  }
);


/* =========================================================
   FREE VIEWER POINTER UP
   ========================================================= */

stage.addEventListener(
  "pointerup",
  async event => {

    pointers.delete(
      event.pointerId
    );


    try {

      stage.releasePointerCapture(
        event.pointerId
      );

    }
    catch {}


    /*
     * PINCH
     */

    if (
      gestureMode ===
        "pinch"
    ) {

      if (
        pointers.size > 0
      ) {

        return;

      }


      gestureMode =
        "idle";


      pinchStartDistance =
        0;


      /*
       * ここでだけPDFを高画質化。
       */

      if (pdf) {

        await rerenderCurrentPdf();

      }


      return;

    }


    /*
     * DRAG
     */

    if (
      gestureMode !==
        "drag"
    ) {

      return;

    }


    if (
      pointers.size > 0
    ) {

      return;

    }


    if (
      dragDirection !==
        0 &&
      adjacentReady
    ) {

      const threshold =
        stage.clientWidth *
        PAGE_COMMIT_RATIO;


      if (
        Math.abs(dragX) >=
        threshold
      ) {

        await commitFreePage();

      }
      else {

        await cancelFreePage();

      }

    }
    else {

      /*
       * 拡大中なら自由パンを確定。
       */

      if (
        zoom >
        PAN_ZOOM_LIMIT
      ) {

        panX +=
          dragX;


        panY +=
          dragY;


        clampPan();


        applyViewTransform();

      }
      else {

        currentSlide.style.transition =
          "transform .18s ease-out";


        currentSlide.style.transform =
          `
            translate3d(
              -50%,
              -50%,
              0
            )
            scale(${zoom})
          `;

      }

    }


    gestureMode =
      "idle";


    dragDirection =
      0;


    dragX =
      0;


    dragY =
      0;

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Pointer cancel
   ========================================================= */

stage.addEventListener(
  "pointercancel",
  () => {

    pointers.clear();


    gestureMode =
      "idle";


    dragDirection =
      0;


    dragX =
      0;


    dragY =
      0;


    hideIncoming();


    applyViewTransform();

  }
);


/* =========================================================
   Commit page
   ========================================================= */

async function commitFreePage() {

  if (
    pageChanging ||
    !dragDirection
  ) {

    return;

  }


  const direction =
    dragDirection;


  const target =
    currentPage +
    direction;


  if (
    target < 1 ||
    target > getPageCount()
  ) {

    await cancelFreePage();

    return;

  }


  pageChanging =
    true;


  try {

    await saveAnnotation();


    const width =
      stage.clientWidth;


    currentSlide.style.transition =
      "transform .24s cubic-bezier(.22,.61,.36,1)";


    incomingSlide.style.transition =
      "transform .24s cubic-bezier(.22,.61,.36,1)";


    currentSlide.style.transform =
      `
        translate3d(
          calc(
            -50% +
            ${
              direction > 0
                ? -width
                : width
            }px
          ),
          -50%,
          0
        )
        scale(${zoom})
      `;


    applyIncomingTransform(
      0,
      0
    );


    await wait(250);


    currentPage =
      target;


    await commitIncoming();

  }
  finally {

    pageChanging =
      false;

  }

}


/* =========================================================
   Cancel page
   ========================================================= */

async function cancelFreePage() {

  currentSlide.style.transition =
    "transform .20s cubic-bezier(.22,.61,.36,1)";


  incomingSlide.style.transition =
    "transform .20s cubic-bezier(.22,.61,.36,1)";


  currentSlide.style.transform =
    `
      translate3d(
        calc(
          -50% +
          ${panX}px
        ),
        calc(
          -50% +
          ${panY}px
        ),
        0
      )
      scale(${zoom})
    `;


  const startX =
    dragDirection > 0
      ? stage.clientWidth
      : -stage.clientWidth;


  applyIncomingTransform(
    startX,
    0
  );


  await wait(210);


  currentSlide.style.transition =
    "none";


  hideIncoming();


  applyViewTransform();

}


/* =========================================================
   Commit incoming
   ========================================================= */

async function commitIncoming() {

  if (pdf) {

    currentPdfCanvas.width =
      incomingPdfCanvas.width;


    currentPdfCanvas.height =
      incomingPdfCanvas.height;


    currentPdfCanvas.style.width =
      incomingPdfCanvas.style.width;


    currentPdfCanvas.style.height =
      incomingPdfCanvas.style.height;


    const context =
      currentPdfCanvas.getContext(
        "2d"
      );


    context.clearRect(

      0,
      0,

      currentPdfCanvas.width,
      currentPdfCanvas.height

    );


    context.drawImage(
      incomingPdfCanvas,
      0,
      0
    );


    currentPdfCanvas.style.display =
      "block";


    currentImage.style.display =
      "none";

  }
  else {

    currentImage.src =
      incomingImage.src;


    currentImage.style.display =
      "block";


    currentPdfCanvas.style.display =
      "none";

  }


  pageWidth =
    incomingSlide.offsetWidth;


  pageHeight =
    incomingSlide.offsetHeight;


  setSlideSize(

    currentSlide,

    pageWidth,
    pageHeight

  );


  resetPan();


  zoom =
    1;


  currentSlide.style.transition =
    "none";


  applyViewTransform();


  hideIncoming();


  resizeAnnotationCanvas(

    pageWidth,
    pageHeight

  );


  updatePageLabel();


  await loadAnnotation();

}


/* =========================================================
   High quality PDF redraw
   ========================================================= */

async function rerenderCurrentPdf() {

  if (!pdf) {
    return;
  }


  const page =
    await pdf.getPage(
      currentPage
    );


  const dpr =
    getPdfDpr();


  const cssViewport =
    page.getViewport({

      scale:
        pdfBaseScale

    });


  const renderViewport =
    page.getViewport({

      scale:
        pdfBaseScale *
        zoom *
        dpr

    });


  currentPdfCanvas.width =
    Math.ceil(
      renderViewport.width
    );


  currentPdfCanvas.height =
    Math.ceil(
      renderViewport.height
    );


  currentPdfCanvas.style.width =
    `${cssViewport.width}px`;


  currentPdfCanvas.style.height =
    `${cssViewport.height}px`;


  const context =
    currentPdfCanvas.getContext(
      "2d",
      {
        alpha:
          false,

        desynchronized:
          true
      }
    );


  context.fillStyle =
    "#fff";


  context.fillRect(

    0,
    0,

    currentPdfCanvas.width,
    currentPdfCanvas.height

  );


  await page.render({

    canvasContext:
      context,

    viewport:
      renderViewport,

    intent:
      "display"

  }).promise;


  pageWidth =
    cssViewport.width;


  pageHeight =
    cssViewport.height;


  setSlideSize(

    currentSlide,

    pageWidth,
    pageHeight

  );


  clampPan();


  applyViewTransform();


  resizeAnnotationCanvas(

    pageWidth,
    pageHeight

  );


  await loadAnnotation();

}


/* =========================================================
   Page buttons
   ========================================================= */

async function goToPage(
  target
) {

  if (
    pageChanging ||
    target < 1 ||
    target > getPageCount() ||
    target === currentPage
  ) {

    return;

  }


  pageChanging =
    true;


  try {

    await saveAnnotation();


    const direction =
      target >
      currentPage
        ? 1
        : -1;


    const loaded =
      await loadIncomingPage(

        target,

        direction

      );


    if (!loaded) {

      return;

    }


    const width =
      stage.clientWidth;


    currentSlide.style.transition =
      "transform .24s cubic-bezier(.22,.61,.36,1)";


    incomingSlide.style.transition =
      "transform .24s cubic-bezier(.22,.61,.36,1)";


    currentSlide.style.transform =
      `
        translate3d(
          calc(
            -50% +
            ${
              direction > 0
                ? -width
                : width
            }px
          ),
          -50%,
          0
        )
        scale(${zoom})
      `;


    applyIncomingTransform(
      0,
      0
    );


    await wait(250);


    currentPage =
      target;


    await commitIncoming();

  }
  finally {

    pageChanging =
      false;

  }

}


/* =========================================================
   Buttons
   ========================================================= */

firstButton?.addEventListener(
  "click",
  () =>
    goToPage(1)
);


previousButton?.addEventListener(
  "click",
  () =>
    goToPage(
      currentPage - 1
    )
);


nextButton?.addEventListener(
  "click",
  () =>
    goToPage(
      currentPage + 1
    )
);


lastButton?.addEventListener(
  "click",
  () =>
    goToPage(
      getPageCount()
    )
);


/* =========================================================
   Zoom buttons
   ========================================================= */

zoomInButton?.addEventListener(
  "click",
  async () => {

    applyZoom(

      zoom * 1.15,

      stage.clientWidth / 2,

      stage.clientHeight / 2

    );


    if (pdf) {

      await rerenderCurrentPdf();

    }

  }
);


zoomOutButton?.addEventListener(
  "click",
  async () => {

    applyZoom(

      zoom / 1.15,

      stage.clientWidth / 2,

      stage.clientHeight / 2

    );


    if (
      zoom <=
      PAN_ZOOM_LIMIT
    ) {

      resetPan();

      applyViewTransform();

    }


    if (pdf) {

      await rerenderCurrentPdf();

    }

  }
);


/* =========================================================
   Fit
   ========================================================= */

fitWidthButton?.addEventListener(
  "click",
  async () => {

    if (pdf) {

      const size =
        await getPdfSize(
          currentPage
        );


      zoom =
        Math.max(

          0.25,

          (
            stage.clientWidth -
            30
          ) /
          (
            size.width *
            pdfBaseScale
          )

        );

    }
    else {

      zoom =
        Math.max(

          0.25,

          (
            stage.clientWidth -
            30
          ) /
          pageWidth

        );

    }


    resetPan();

    applyViewTransform();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  }
);


fitHeightButton?.addEventListener(
  "click",
  async () => {

    if (pdf) {

      const size =
        await getPdfSize(
          currentPage
        );


      zoom =
        Math.max(

          0.25,

          (
            stage.clientHeight -
            30
          ) /
          (
            size.height *
            pdfBaseScale
          )

        );

    }
    else {

      zoom =
        Math.max(

          0.25,

          (
            stage.clientHeight -
            30
          ) /
          pageHeight

        );

    }


    resetPan();

    applyViewTransform();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  }
);


/* =========================================================
   PRINT
   ========================================================= */

printButton?.addEventListener(
  "click",
  async () => {

    /*
     * 重要:
     *
     * awaitする前にwindow.openする。
     * これでポップアップブロックを回避。
     */

    const printWindow =
      window.open(
        "about:blank",
        "_blank"
      );


    if (!printWindow) {

      showMessage(
        "印刷用ウィンドウを開けませんでした。ブラウザのポップアップ許可を確認してください。"
      );

      return;

    }


    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>印刷準備中</title>
        <style>
          html,
          body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          body {
            font-family:
              system-ui,
              sans-serif;

            display: flex;
            align-items: center;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        印刷を準備しています。
      </body>
      </html>
    `);


    printWindow.document.close();


    try {

      if (pdf) {

        const url =
          await getSignedUrl(
            book.file_path
          );


        printWindow.location.href =
          url;


        /*
         * PDF本体の読み込み完了後、
         * 印刷ダイアログを開く。
         */

        setTimeout(
          () => {

            try {

              printWindow.focus();

              printWindow.print();

            }
            catch {}

          },
          1500
        );

      }
      else {

        /*
         * 画像Book。
         *
         * 現在ページを印刷。
         */

        const image =
          await getImage(
            currentPage
          );


        printWindow.document.body.innerHTML =
          `
            <img
              src="${escapeAttribute(
                image.src
              )}"
              style="
                max-width:100%;
                height:auto;
                display:block;
                margin:auto;
              ">
          `;


        printWindow.document.title =
          book?.title ||
          "印刷";


        printWindow.focus();


        setTimeout(
          () => {

            try {

              printWindow.print();

            }
            catch {}

          },
          300
        );

      }

    }
    catch (error) {

      console.error(
        "PRINT ERROR:",
        error
      );


      try {

        printWindow.close();

      }
      catch {}


      showMessage(
        error.message ||
        "印刷を開始できませんでした。"
      );

    }

  }
);


/* =========================================================
   Escape
   ========================================================= */

function escapeAttribute(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );

}


/* =========================================================
   Fullscreen
   ========================================================= */

fullscreenButton?.addEventListener(
  "click",
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
    catch (error) {

      console.warn(
        "FULLSCREEN ERROR:",
        error
      );

    }

  }
);


/* =========================================================
   Mode
   ========================================================= */

function updateMode() {

  moveButton?.classList.toggle(
    "active",
    viewerMode === "move"
  );


  penButton?.classList.toggle(
    "active",
    viewerMode === "pen"
  );


  eraserButton?.classList.toggle(
    "active",
    viewerMode === "eraser"
  );


  const penLabel =
    penButton?.querySelector(
      "span"
    );


  if (penLabel) {

    penLabel.textContent =
      viewerMode === "pen"
        ? "ペン ON"
        : "ペン";

  }


  document.body.classList.toggle(
    "pen-enabled",
    viewerMode === "pen"
  );


  document.body.classList.toggle(
    "eraser-enabled",
    viewerMode === "eraser"
  );

}


function setMode(
  mode
) {

  viewerMode =
    mode;


  drawing =
    false;


  updateMode();

}


moveButton?.addEventListener(
  "click",
  () =>
    setMode("move")
);


penButton?.addEventListener(
  "click",
  () =>
    setMode(
      viewerMode === "pen"
        ? "move"
        : "pen"
    )
);


eraserButton?.addEventListener(
  "click",
  () =>
    setMode("eraser")
);


/* =========================================================
   Favorite
   ========================================================= */

favoriteButton?.addEventListener(
  "click",
  event => {

    event.currentTarget
      .classList.toggle(
        "active"
      );

  }
);


/* =========================================================
   Mobile menu
   ========================================================= */

function closeMenu() {

  mobileMenu?.classList.remove(
    "open"
  );


  mobileMenu?.setAttribute(
    "aria-hidden",
    "true"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "false"
  );

}


menuButton?.addEventListener(
  "click",
  () => {

    if (!mobileMenu) {
      return;
    }


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


    menuButton?.setAttribute(
      "aria-expanded",
      String(
        open
      )
    );

  }
);


mobileMenu
  ?.querySelectorAll(
    "[data-action]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        async () => {

          const action =
            button.dataset.action;


          if (
            action === "first"
          ) {

            await goToPage(1);

          }
          else if (
            action === "previous"
          ) {

            await goToPage(
              currentPage - 1
            );

          }
          else if (
            action === "next"
          ) {

            await goToPage(
              currentPage + 1
            );

          }
          else if (
            action === "last"
          ) {

            await goToPage(
              getPageCount()
            );

          }
          else if (
            action === "move"
          ) {

            setMode("move");

          }
          else if (
            action === "pen"
          ) {

            setMode("pen");

          }
          else if (
            action === "eraser"
          ) {

            setMode("eraser");

          }
          else if (
            action === "zoomIn"
          ) {

            zoomInButton?.click();

          }
          else if (
            action === "zoomOut"
          ) {

            zoomOutButton?.click();

          }
          else if (
            action === "fitWidth"
          ) {

            fitWidthButton?.click();

          }
          else if (
            action === "fitHeight"
          ) {

            fitHeightButton?.click();

          }
          else if (
            action === "print"
          ) {

            printButton?.click();

          }
          else if (
            action === "fullscreen"
          ) {

            fullscreenButton?.click();

          }


          closeMenu();

        }
      );

    }
  );


/* =========================================================
   High DPI Pen
   ========================================================= */

function resizeAnnotationCanvas(
  width,
  height
) {

  const dpr =
    getPenDpr();


  /*
   * 新しいCanvasを作る。
   */

  const old =
    document.createElement(
      "canvas"
    );


  old.width =
    annotationCanvas.width;


  old.height =
    annotationCanvas.height;


  if (
    old.width &&
    old.height
  ) {

    const oldContext =
      old.getContext(
        "2d"
      );


    oldContext.drawImage(
      annotationCanvas,
      0,
      0
    );

  }


  annotationCanvas.width =
    Math.max(
      1,
      Math.ceil(
        width *
        dpr
      )
    );


  annotationCanvas.height =
    Math.max(
      1,
      Math.ceil(
        height *
        dpr
      )
    );


  annotationCanvas.style.width =
    `${width}px`;


  annotationCanvas.style.height =
    `${height}px`;


  if (
    old.width &&
    old.height
  ) {

    const context =
      annotationCanvas.getContext(
        "2d"
      );


    context.drawImage(

      old,

      0,
      0,
      old.width,
      old.height,

      0,
      0,
      annotationCanvas.width,
      annotationCanvas.height

    );

  }

}


function getAnnotationPoint(
  event
) {

  const rect =
    annotationCanvas
      .getBoundingClientRect();


  return {

    x:
      (
        event.clientX -
        rect.left
      ) *
      (
        annotationCanvas.width /
        rect.width
      ),

    y:
      (
        event.clientY -
        rect.top
      ) *
      (
        annotationCanvas.height /
        rect.height
      )

  };

}


/*
 * 高DPI・滑らか線。
 */

function drawPenSegment(
  context,
  x,
  y
) {

  const midX =
    (
      lastX +
      x
    ) / 2;


  const midY =
    (
      lastY +
      y
    ) / 2;


  context.beginPath();


  context.moveTo(
    lastMidX,
    lastMidY
  );


  context.quadraticCurveTo(

    lastX,
    lastY,

    midX,
    midY

  );


  context.stroke();


  lastMidX =
    midX;


  lastMidY =
    midY;


  lastX =
    x;


  lastY =
    y;

}


/* =========================================================
   Pen DOWN
   ========================================================= */

annotationCanvas.addEventListener(
  "pointerdown",
  event => {

    if (
      viewerMode !== "pen" &&
      viewerMode !== "eraser"
    ) {

      return;

    }


    event.stopPropagation();


    event.preventDefault();


    drawing =
      true;


    try {

      annotationCanvas.setPointerCapture(
        event.pointerId
      );

    }
    catch {}


    const point =
      getAnnotationPoint(
        event
      );


    lastX =
      point.x;


    lastY =
      point.y;


    lastMidX =
      point.x;


    lastMidY =
      point.y;


    const context =
      annotationCanvas.getContext(
        "2d"
      );


    const dpr =
      getPenDpr();


    context.lineCap =
      "round";


    context.lineJoin =
      "round";


    context.miterLimit =
      2;


    if (
      viewerMode ===
      "eraser"
    ) {

      context.globalCompositeOperation =
        "destination-out";


      context.lineWidth =
        ERASER_WIDTH *
        dpr;

    }
    else {

      context.globalCompositeOperation =
        "source-over";


      context.strokeStyle =
        "#111";


      context.lineWidth =
        PEN_WIDTH *
        dpr;

    }


    /*
     * 点だけでも描けるようにする。
     */

    context.beginPath();


    context.arc(

      point.x,
      point.y,

      context.lineWidth / 2,

      0,
      Math.PI * 2

    );


    context.fillStyle =
      viewerMode === "eraser"
        ? "rgba(0,0,0,1)"
        : "#111";


    if (
      viewerMode === "eraser"
    ) {

      context.fill();

    }
    else {

      context.fill();

    }

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Pen MOVE
   ========================================================= */

annotationCanvas.addEventListener(
  "pointermove",
  event => {

    if (!drawing) {
      return;
    }


    event.stopPropagation();


    event.preventDefault();


    const point =
      getAnnotationPoint(
        event
      );


    const context =
      annotationCanvas.getContext(
        "2d"
      );


    drawPenSegment(

      context,

      point.x,

      point.y

    );


    annotationDirty =
      true;

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Pen UP
   ========================================================= */

annotationCanvas.addEventListener(
  "pointerup",
  async event => {

    if (!drawing) {
      return;

    }


    event.stopPropagation();


    event.preventDefault();


    drawing =
      false;


    try {

      annotationCanvas.releasePointerCapture(
        event.pointerId
      );

    }
    catch {}


    if (
      annotationDirty
    ) {

      annotationDirty =
        false;


      await saveAnnotation();

    }

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Pen CANCEL
   ========================================================= */

annotationCanvas.addEventListener(
  "pointercancel",
  event => {

    event.stopPropagation();


    drawing =
      false;

  }
);


/* =========================================================
   Annotation save
   ========================================================= */

async function saveAnnotation() {

  if (
    !student?.id ||
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
   Annotation load
   ========================================================= */

async function loadAnnotation() {

  if (!student?.id) {
    return;
  }


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


  await new Promise(
    resolve => {

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


          resolve();

        };


      image.onerror =
        () =>
          resolve();


      image.src =
        source;

    }
  );

}


/* =========================================================
   Close
   ========================================================= */

closeButton?.addEventListener(
  "click",
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

  }
);


/* =========================================================
   Resize
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    clampPan();


    applyViewTransform();

  }
);


/* =========================================================
   Start
   ========================================================= */

async function start() {

  hideMessage();


  student =
    await requireBookAccess(
      bookId
    );


  if (!student) {
    return;
  }


  const loaded =
    await loadBook();


  if (!loaded) {
    return;
  }


  if (
    isPdfBook()
  ) {

    await loadPdf();

  }
  else {

    await loadImagePages();

  }


  currentPage =
    1;


  updateMode();


  await renderCurrent();

}


/* =========================================================
   Boot
   ========================================================= */

start()
  .catch(
    error => {

      console.error(
        "VIEWER ERROR:",
        error
      );


      hideLoading();


      showMessage(
        error.message ||
        "教材を表示できませんでした。"
      );

    }
  );
