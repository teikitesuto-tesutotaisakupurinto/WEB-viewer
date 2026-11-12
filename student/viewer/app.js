
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


/*
 * move / pen / eraser
 */

let viewerMode =
  "move";


/*
 * idle
 * page
 * pan
 * pinch
 */

let gestureMode =
  "idle";


/*
 * Zoom
 */

let zoom =
  1;

const MIN_ZOOM =
  1;

const MAX_ZOOM =
  4;


/*
 * PDF基準倍率
 */

let pdfBaseScale =
  1;


/*
 * ページの論理サイズ
 */

let pageWidth =
  0;

let pageHeight =
  0;


/*
 * パン
 */

let panX =
  0;

let panY =
  0;

let panStartX =
  0;

let panStartY =
  0;

let panBaseX =
  0;

let panBaseY =
  0;


/*
 * ページ切り替え
 */

let pageChanging =
  false;


/*
 * Pointer管理
 */

const activePointers =
  new Map();


/*
 * ページスワイプ
 */

let swipeStartX =
  0;

let swipeStartY =
  0;

let swipeLastX =
  0;

let swipeLastY =
  0;

let swipeDirection =
  0;

let swipePrepared =
  false;

let swipePreparing =
  false;


/*
 * ピンチ
 */

let pinchStartDistance =
  0;

let pinchStartZoom =
  1;


/*
 * PDF描画世代
 */

let renderToken =
  0;


/*
 * 画像キャッシュ
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


/*
 * Desktop mouse
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


/*
 * incomingページ準備
 */

let incomingPromise =
  null;


/* =========================================================
   Constants
   ========================================================= */

const PAN_ZOOM_LIMIT =
  1.03;

const SWIPE_MIN_DISTANCE =
  60;

const SWIPE_AXIS_RATIO =
  1.2;

const MAX_DPR =
  2.5;


/* =========================================================
   Loading
   ========================================================= */

function showLoading() {

  if (!loadingOverlay) {
    return;
  }


  loadingOverlay.classList.remove(
    "hidden"
  );


  loadingOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

}


function hideLoading() {

  if (!loadingOverlay) {
    return;
  }


  loadingOverlay.classList.add(
    "hidden"
  );


  loadingOverlay.setAttribute(
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
   PDF.js
   ========================================================= */

async function loadPdfJs() {

  if (pdfjs) {
    return pdfjs;
  }


  try {

    pdfjs =
      await import(
        "../../assets/pdfjs/pdf.mjs"
      );

  }
  catch (error) {

    console.error(
      "PDF.JS ERROR:",
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


  pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
      "../../assets/pdfjs/pdf.worker.mjs",
      import.meta.url
    ).href;


  return pdfjs;

}


/* =========================================================
   PDF load
   ========================================================= */

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

function getDpr() {

  return Math.min(
    MAX_DPR,
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


  const availableWidth =
    Math.max(
      200,
      stage.clientWidth - 48
    );


  const availableHeight =
    Math.max(
      200,
      stage.clientHeight - 48
    );


  return Math.min(

    availableWidth /
      size.width,

    availableHeight /
      size.height

  );

}


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
    getDpr();


  const cssViewport =
    page.getViewport({

      scale:
        cssScale

    });


  const renderViewport =
    page.getViewport({

      scale:
        cssScale * dpr

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
          false
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
  offsetX
) {

  incomingSlide.style.transform =
    `
      translate3d(
        calc(
          -50% +
          ${offsetX}px
        ),
        -50%,
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


  incomingReady =
    false;

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
   Incoming page
   ========================================================= */

async function loadIncomingPage(
  targetPage,
  direction
) {

  incomingReady =
    false;


  if (
    targetPage < 1 ||
    targetPage > getPageCount()
  ) {

    return false;

  }


  incomingPdfCanvas.style.display =
    "none";


  incomingImage.style.display =
    "none";


  if (pdf) {

    const size =
      await renderPdfCanvas(

        incomingPdfCanvas,

        targetPage,

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
        targetPage
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


  const start =
    direction > 0
      ? stage.clientWidth
      : -stage.clientWidth;


  applyIncomingTransform(
    start
  );


  incomingReady =
    true;


  return true;

}


/* =========================================================
   Prepare incoming
   ========================================================= */

function prepareIncoming(
  direction
) {

  if (
    incomingPromise
  ) {

    return incomingPromise;

  }


  const target =
    currentPage +
    direction;


  if (
    target < 1 ||
    target > getPageCount()
  ) {

    return Promise.resolve(
      false
    );

  }


  swipePreparing =
    true;


  incomingPromise =
    loadIncomingPage(
      target,
      direction
    )
      .catch(
        error => {

          console.error(
            "INCOMING PAGE ERROR:",
            error
          );


          hideIncoming();


          return false;

        }
      )
      .finally(
        () => {

          incomingPromise =
            null;

          swipePreparing =
            false;

        }
      );


  return incomingPromise;

}


/* =========================================================
   Pointer helpers
   ========================================================= */

function getPointerDistance() {

  const values =
    [...activePointers.values()];


  if (
    values.length < 2
  ) {

    return 0;

  }


  const a =
    values[0];

  const b =
    values[1];


  return Math.hypot(

    b.x -
    a.x,

    b.y -
    a.y

  );

}


function getPointerCenter() {

  const values =
    [...activePointers.values()];


  if (
    values.length < 2
  ) {

    return {

      x:
        stage.clientWidth / 2,

      y:
        stage.clientHeight / 2

    };

  }


  const a =
    values[0];

  const b =
    values[1];


  return {

    x:
      (
        a.x +
        b.x
      ) / 2,

    y:
      (
        a.y +
        b.y
      ) / 2

  };

}


/* =========================================================
   POINTER DOWN
   ========================================================= */

stage.addEventListener(
  "pointerdown",
  event => {

    /*
     * ペン・消しゴムは
     * annotationCanvas側。
     */

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


    activePointers.set(

      event.pointerId,

      {

        x:
          event.clientX,

        y:
          event.clientY

      }

    );


    /*
     * =====================================================
     * PINCH
     * =====================================================
     */

    if (
      activePointers.size >= 2
    ) {

      gestureMode =
        "pinch";


      swipeActive =
        false;


      swipeDirection =
        0;


      swipePrepared =
        false;


      hideIncoming();


      pinchStartDistance =
        getPointerDistance();


      pinchStartZoom =
        zoom;


      return;

    }


    /*
     * =====================================================
     * 1本指
     * =====================================================
     */

    if (
      activePointers.size !==
      1 ||
      pageChanging
    ) {

      return;

    }


    swipeStartX =
      event.clientX;


    swipeStartY =
      event.clientY;


    swipeLastX =
      event.clientX;


    swipeLastY =
      event.clientY;


    swipeDirection =
      0;


    swipePrepared =
      false;


    swipeActive =
      true;


    /*
     * 拡大中
     *
     * 1本指はパン。
     */

    if (
      zoom >
      PAN_ZOOM_LIMIT
    ) {

      gestureMode =
        "pan";


      panStartX =
        event.clientX;


      panStartY =
        event.clientY;


      panBaseX =
        panX;


      panBaseY =
        panY;


      return;

    }


    /*
     * 通常倍率
     *
     * ページ送り。
     */

    gestureMode =
      "page";

  },
  {
    passive:
      false
  }
);


/* =========================================================
   POINTER MOVE
   ========================================================= */

stage.addEventListener(
  "pointermove",
  event => {

    if (
      activePointers.has(
        event.pointerId
      )
    ) {

      activePointers.set(

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
     * =====================================================
     * PINCH
     * =====================================================
     */

    if (
      gestureMode ===
        "pinch" &&
      activePointers.size >= 2
    ) {

      event.preventDefault();


      const distance =
        getPointerDistance();


      if (
        pinchStartDistance <= 0
      ) {

        pinchStartDistance =
          distance;


        pinchStartZoom =
          zoom;


        return;

      }


      const center =
        getPointerCenter();


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
     * =====================================================
     * PAN
     * =====================================================
     */

    if (
      gestureMode ===
        "pan" &&
      activePointers.size === 1
    ) {

      event.preventDefault();


      panX =
        panBaseX +
        (
          event.clientX -
          panStartX
        );


      panY =
        panBaseY +
        (
          event.clientY -
          panStartY
        );


      clampPan();


      applyViewTransform();


      return;

    }


    /*
     * =====================================================
     * PAGE
     * =====================================================
     */

    if (
      gestureMode !==
        "page" ||
      activePointers.size !==
        1 ||
      !swipeActive
    ) {

      return;

    }


    const dx =
      event.clientX -
      swipeStartX;


    const dy =
      event.clientY -
      swipeStartY;


    swipeLastX =
      event.clientX;


    swipeLastY =
      event.clientY;


    /*
     * 縦方向が明確なら
     * ページ送りしない。
     */

    if (
      !swipeDirection &&
      Math.abs(dy) >
      Math.abs(dx) *
      SWIPE_AXIS_RATIO
    ) {

      return;

    }


    /*
     * 横方向へ動いたら方向確定。
     */

    if (
      !swipeDirection &&
      Math.abs(dx) >= 8
    ) {

      const direction =
        dx < 0
          ? 1
          : -1;


      const target =
        currentPage +
        direction;


      /*
       * 存在しないページ方向。
       */

      if (
        target < 1 ||
        target > getPageCount()
      ) {

        return;

      }


      swipeDirection =
        direction;


      /*
       * 先読み。
       *
       * awaitしない。
       */

      prepareIncoming(
        direction
      )
        .then(
          success => {

            if (
              !success
            ) {

              return;

            }


            if (
              gestureMode !==
                "page" ||
              swipeDirection !==
                direction
            ) {

              return;

            }


            swipePrepared =
              true;


            /*
             * 読み込み完了時点の
             * 指位置に合わせる。
             */

            const currentDx =
              swipeLastX -
              swipeStartX;


            const incomingStart =
              direction > 0
                ? stage.clientWidth
                : -stage.clientWidth;


            applyIncomingTransform(

              incomingStart +
              currentDx

            );

          }
        );

    }


    if (
      !swipeDirection
    ) {

      return;

    }


    /*
     * 逆方向へ指を戻しても
     * ページ方向は変更しない。
     */

    event.preventDefault();


    /*
     * 現在ページを指に追従。
     */

    currentSlide.style.transform =
      `
        translate3d(
          calc(
            -50% +
            ${dx}px
          ),
          -50%,
          0
        )
        scale(${zoom})
      `;


    /*
     * incomingも指に追従。
     */

    if (
      incomingSlide.style.display !==
      "none"
    ) {

      const incomingStart =
        swipeDirection > 0
          ? stage.clientWidth
          : -stage.clientWidth;


      applyIncomingTransform(

        incomingStart +
        dx

      );

    }

  },
  {
    passive:
      false
  }
);


/* =========================================================
   POINTER UP
   ========================================================= */

stage.addEventListener(
  "pointerup",
  async event => {

    activePointers.delete(
      event.pointerId
    );


    try {

      stage.releasePointerCapture(
        event.pointerId
      );

    }
    catch {}


    /*
     * =====================================================
     * PINCH
     * =====================================================
     */

    if (
      gestureMode ===
        "pinch"
    ) {

      if (
        activePointers.size > 0
      ) {

        /*
         * もう片方の指が残っている。
         */

        return;

      }


      gestureMode =
        "idle";


      pinchStartDistance =
        0;


      swipeActive =
        false;


      /*
       * PDFは指を離したときだけ
       * 高画質再描画。
       */

      if (pdf) {

        await rerenderCurrentPdf();

      }


      return;

    }


    /*
     * =====================================================
     * PAN
     * =====================================================
     */

    if (
      gestureMode ===
        "pan"
    ) {

      if (
        activePointers.size ===
        0
      ) {

        gestureMode =
          "idle";


        swipeActive =
          false;

      }


      /*
       * panX / panY はそのまま。
       */

      return;

    }


    /*
     * =====================================================
     * PAGE
     * =====================================================
     */

    if (
      gestureMode !==
        "page"
    ) {

      return;

    }


    swipeActive =
      false;


    if (
      activePointers.size > 0
    ) {

      return;

    }


    const dx =
      event.clientX -
      swipeStartX;


    const dy =
      event.clientY -
      swipeStartY;


    const horizontal =
      Math.abs(dx) >
      Math.abs(dy) *
      SWIPE_AXIS_RATIO;


    const enough =
      Math.abs(dx) >=
      SWIPE_MIN_DISTANCE;


    /*
     * ページ送り条件を満たさない。
     */

    if (
      !horizontal ||
      !enough ||
      !swipeDirection
    ) {

      cancelPointerSwipe();

      return;

    }


    /*
     * incomingがまだ準備中なら待つ。
     */

    if (
      !swipePrepared
    ) {

      const started =
        performance.now();


      while (
        !swipePrepared &&
        performance.now() -
          started <
          1500
      ) {

        await wait(16);

      }

    }


    if (
      !swipePrepared
    ) {

      cancelPointerSwipe();

      return;

    }


    swipeDirection =
      swipeDirection;


    swipePrepared =
      true;


    gestureMode =
      "idle";


    await finishSwipe();

  },
  {
    passive:
      false
  }
);


/* =========================================================
   POINTER CANCEL
   ========================================================= */

stage.addEventListener(
  "pointercancel",
  event => {

    activePointers.delete(
      event.pointerId
    );


    if (
      activePointers.size ===
      0
    ) {

      swipeActive =
        false;


      swipeDirection =
        0;


      swipePrepared =
        false;


      gestureMode =
        "idle";


      pinchStartDistance =
        0;


      hideIncoming();


      applyViewTransform();

    }

  },
  {
    passive:
      false
  }
);


/* =========================================================
   Cancel swipe
   ========================================================= */

function cancelPointerSwipe() {

  hideIncoming();


  /*
   * 現在ページの位置・倍率は
   * 勝手に変更しない。
   */

  applyViewTransform();


  swipeActive =
    false;


  swipeDirection =
    0;


  swipePrepared =
    false;


  gestureMode =
    "idle";


  swipeLastX =
    0;


  swipeLastY =
    0;

}


/* =========================================================
   Finish swipe
   ========================================================= */

async function finishSwipe() {

  if (
    pageChanging
  ) {

    return;

  }


  const direction =
    swipeDirection;


  const target =
    currentPage +
    direction;


  if (
    target < 1 ||
    target > getPageCount()
  ) {

    cancelPointerSwipe();

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


    /*
     * 現在ページを完全に画面外へ。
     */

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


    /*
     * incomingを完全に中央へ。
     */

    applyIncomingTransform(
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


    swipeDirection =
      0;


    swipePrepared =
      false;


    swipeActive =
      false;


    gestureMode =
      "idle";

  }

}


/* =========================================================
   Commit incoming
   ========================================================= */

async function commitIncoming() {

  if (
    pdf
  ) {

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


  /*
   * 新ページのサイズ。
   */

  pageWidth =
    incomingSlide.offsetWidth;


  pageHeight =
    incomingSlide.offsetHeight;


  setSlideSize(

    currentSlide,

    pageWidth,

    pageHeight

  );


  /*
   * 新ページに移動したときだけ
   * 中央へ戻す。
   */

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
   PDF high quality
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
    getDpr();


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
          false
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
    pageChanging
  ) {

    return;

  }


  if (
    target < 1 ||
    target > getPageCount()
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


    const direction =
      target >
      currentPage
        ? 1
        : -1;


    await loadIncomingPage(

      target,

      direction

    );


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


if (firstButton) {

  firstButton.onclick =
    () =>
      goToPage(1);

}


if (previousButton) {

  previousButton.onclick =
    () =>
      goToPage(
        currentPage - 1
      );

}


if (nextButton) {

  nextButton.onclick =
    () =>
      goToPage(
        currentPage + 1
      );

}


if (lastButton) {

  lastButton.onclick =
    () =>
      goToPage(
        getPageCount()
      );

}


/* =========================================================
   Zoom buttons
   ========================================================= */

if (zoomInButton) {

  zoomInButton.onclick =
    async () => {

      applyZoom(

        zoom * 1.12,

        stage.clientWidth / 2,

        stage.clientHeight / 2

      );


      if (pdf) {

        await rerenderCurrentPdf();

      }

    };

}


if (zoomOutButton) {

  zoomOutButton.onclick =
    async () => {

      applyZoom(

        zoom / 1.12,

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

    };

}


/* =========================================================
   Fit width
   ========================================================= */

if (fitWidthButton) {

  fitWidthButton.onclick =
    async () => {

      if (pdf) {

        const size =
          await getPdfSize(
            currentPage
          );


        const width =
          size.width *
          pdfBaseScale;


        zoom =
          Math.max(

            0.25,

            (
              stage.clientWidth -
              30
            ) /
            width

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

    };

}


/* =========================================================
   Fit height
   ========================================================= */

if (fitHeightButton) {

  fitHeightButton.onclick =
    async () => {

      if (pdf) {

        const size =
          await getPdfSize(
            currentPage
          );


        const height =
          size.height *
          pdfBaseScale;


        zoom =
          Math.max(

            0.25,

            (
              stage.clientHeight -
              30
            ) /
            height

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

    };

}


/* =========================================================
   Fullscreen
   ========================================================= */

if (fullscreenButton) {

  fullscreenButton.onclick =
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

}


/* =========================================================
   Mode
   ========================================================= */

function updateMode() {

  if (moveButton) {

    moveButton.classList.toggle(
      "active",
      viewerMode === "move"
    );

  }


  if (penButton) {

    penButton.classList.toggle(
      "active",
      viewerMode === "pen"
    );


    penButton.textContent =
      viewerMode === "pen"
        ? "ペン ON"
        : "ペン OFF";

  }


  document.body.classList.toggle(
    "pen-enabled",
    viewerMode === "pen"
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


if (moveButton) {

  moveButton.onclick =
    () =>
      setMode("move");

}


if (penButton) {

  penButton.onclick =
    () =>
      setMode(

        viewerMode === "pen"
          ? "move"
          : "pen"

      );

}


if (eraserButton) {

  eraserButton.onclick =
    () =>
      setMode("eraser");

}


/* =========================================================
   Favorite
   ========================================================= */

if (favoriteButton) {

  favoriteButton.onclick =
    event => {

      event.currentTarget
        .classList.toggle(
          "active"
        );

    };

}


/* =========================================================
   Mobile menu
   ========================================================= */

function closeMenu() {

  if (!mobileMenu) {
    return;
  }


  mobileMenu.classList.remove(
    "open"
  );


  mobileMenu.setAttribute(
    "aria-hidden",
    "true"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "false"
  );

}


if (
  menuButton &&
  mobileMenu
) {

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
              action ===
              "first"
            ) {

              await goToPage(1);

            }
            else if (
              action ===
              "previous"
            ) {

              await goToPage(
                currentPage - 1
              );

            }
            else if (
              action ===
              "next"
            ) {

              await goToPage(
                currentPage + 1
              );

            }
            else if (
              action ===
              "last"
            ) {

              await goToPage(
                getPageCount()
              );

            }
            else if (
              action ===
              "move"
            ) {

              setMode("move");

            }
            else if (
              action ===
              "pen"
            ) {

              setMode("pen");

            }
            else if (
              action ===
              "eraser"
            ) {

              setMode("eraser");

            }
            else if (
              action ===
              "favorite"
            ) {

              favoriteButton?.click();

            }
            else if (
              action ===
              "zoomIn"
            ) {

              zoomInButton?.click();

            }
            else if (
              action ===
              "zoomOut"
            ) {

              zoomOutButton?.click();

            }
            else if (
              action ===
              "fitWidth"
            ) {

              fitWidthButton?.click();

            }
            else if (
              action ===
              "fitHeight"
            ) {

              fitHeightButton?.click();

            }
            else if (
              action ===
              "fullscreen"
            ) {

              fullscreenButton?.click();

            }


            closeMenu();

          };

      }
    );

}


/* =========================================================
   Desktop pan
   ========================================================= */

stage.addEventListener(
  "mousedown",
  event => {

    if (
      viewerMode !==
      "move"
    ) {

      return;

    }


    if (
      zoom <=
      PAN_ZOOM_LIMIT
    ) {

      return;

    }


    mouseDown =
      true;


    mouseStartX =
      event.clientX;


    mouseStartY =
      event.clientY;


    mouseBaseX =
      panX;


    mouseBaseY =
      panY;


    stage.classList.add(
      "dragging"
    );

  }
);


window.addEventListener(
  "mousemove",
  event => {

    if (!mouseDown) {
      return;
    }


    panX =
      mouseBaseX +
      (
        event.clientX -
        mouseStartX
      );


    panY =
      mouseBaseY +
      (
        event.clientY -
        mouseStartY
      );


    clampPan();


    applyViewTransform();

  }
);


window.addEventListener(
  "mouseup",
  () => {

    mouseDown =
      false;


    stage.classList.remove(
      "dragging"
    );

  }
);


/* =========================================================
   Annotation
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


annotationCanvas.addEventListener(
  "pointerdown",
  event => {

    if (
      viewerMode !== "pen" &&
      viewerMode !== "eraser"
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
      viewerMode ===
      "eraser"
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
   Annotation
   ========================================================= */

async function saveAnnotation() {

  if (
    !annotationCanvas.width ||
    !annotationCanvas.height
  ) {

    return;

  }


  if (!student?.id) {
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
   Close
   ========================================================= */

if (closeButton) {

  closeButton.onclick =
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

}


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
