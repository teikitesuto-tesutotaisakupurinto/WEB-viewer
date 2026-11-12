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
 * swipe
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


/*
 * PDFの基準CSS倍率。
 */

let pdfBaseScale =
  1;


/*
 * ページの論理サイズ。
 */

let pageWidth =
  0;

let pageHeight =
  0;


/*
 * パン位置。
 */

let panX =
  0;

let panY =
  0;


/*
 * パン開始位置。
 */

let panStartX =
  0;

let panStartY =
  0;

let panBaseX =
  0;

let panBaseY =
  0;


/*
 * ページ移動。
 */

let pageChanging =
  false;


/*
 * スワイプ。
 */

let swipeStartX =
  0;

let swipeStartY =
  0;

let swipeCurrentX =
  0;

let swipeCurrentY =
  0;

let swipeDirection =
  0;

let incomingReady =
  false;

let incomingPromise =
  null;


/*
 * ピンチ。
 */

let pinchStartDistance =
  0;

let pinchStartZoom =
  1;


/*
 * ペン。
 */

let drawing =
  false;

let lastX =
  0;

let lastY =
  0;


/*
 * PDF描画世代。
 */

let renderToken =
  0;


/*
 * 画像キャッシュ。
 */

const imageCache =
  new Map();


/*
 * Desktop mouse.
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

const MIN_ZOOM =
  1;

const MAX_ZOOM =
  4;


/*
 * これを超えたら1本指は
 * ページ送りではなくパン。
 */

const PAN_ZOOM_LIMIT =
  1.03;


/*
 * ページ送り確定距離。
 */

const SWIPE_MIN_DISTANCE =
  70;


/*
 * 縦より横が明確に大きい場合。
 */

const SWIPE_AXIS_RATIO =
  1.25;


/*
 * PDF高DPI上限。
 */

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
   Page count
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
        alpha: false
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
  centerX,
  centerY
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
    centerX -
    rect.left -
    rect.width / 2;


  const localY =
    centerY -
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
          stage.clientWidth - 48
        ) /
        pageWidth,

        (
          stage.clientHeight - 48
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
   Start preparing incoming
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

        }
      );


  return incomingPromise;

}


/* =========================================================
   Touch helpers
   ========================================================= */

function getTouchDistance(
  touches
) {

  if (
    touches.length <
    2
  ) {

    return 0;

  }


  const a =
    touches[0];

  const b =
    touches[1];


  return Math.hypot(

    b.clientX -
    a.clientX,

    b.clientY -
    a.clientY

  );

}


function getTouchCenter(
  touches
) {

  return {

    x:
      (
        touches[0].clientX +
        touches[1].clientX
      ) / 2,

    y:
      (
        touches[0].clientY +
        touches[1].clientY
      ) / 2

  };

}


/* =========================================================
   Touch START
   ========================================================= */

stage.addEventListener(
  "touchstart",
  event => {

    /*
     * 2本指
     */

    if (
      event.touches.length >= 2
    ) {

      gestureMode =
        "pinch";


      swipeActive =
        false;


      swipeDirection =
        0;


      pinchStartDistance =
        getTouchDistance(
          event.touches
        );


      pinchStartZoom =
        zoom;


      hideIncoming();


      return;

    }


    if (
      event.touches.length !==
      1
    ) {

      return;

    }


    if (
      pageChanging
    ) {

      return;

    }


    const touch =
      event.touches[0];


    swipeStartX =
      touch.clientX;


    swipeStartY =
      touch.clientY;


    swipeCurrentX =
      touch.clientX;


    swipeCurrentY =
      touch.clientY;


    swipeDirection =
      0;


    incomingReady =
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
        touch.clientX;


      panStartY =
        touch.clientY;


      panBaseX =
        panX;


      panBaseY =
        panY;


      return;

    }


    /*
     * 通常倍率
     *
     * ページ送り候補。
     */

    gestureMode =
      "swipe";

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch MOVE
   ========================================================= */

stage.addEventListener(
  "touchmove",
  event => {

    /*
     * =====================================================
     * PINCH
     * =====================================================
     */

    if (
      event.touches.length >= 2
    ) {

      event.preventDefault();


      if (
        gestureMode !==
        "pinch"
      ) {

        gestureMode =
          "pinch";


        swipeActive =
          false;


        pinchStartDistance =
          getTouchDistance(
            event.touches
          );


        pinchStartZoom =
          zoom;

      }


      const distance =
        getTouchDistance(
          event.touches
        );


      if (
        pinchStartDistance <= 0
      ) {

        return;

      }


      const center =
        getTouchCenter(
          event.touches
        );


      applyZoom(

        pinchStartZoom *
        (
          distance /
          pinchStartDistance
        ),

        center.x,

        center.y

      );


      return;

    }


    /*
     * 1本指以外。
     */

    if (
      event.touches.length !==
      1
    ) {

      return;

    }


    const touch =
      event.touches[0];


    swipeCurrentX =
      touch.clientX;


    swipeCurrentY =
      touch.clientY;


    /*
     * =====================================================
     * PAN
     * =====================================================
     */

    if (
      gestureMode ===
      "pan"
    ) {

      event.preventDefault();


      panX =
        panBaseX +
        (
          touch.clientX -
          panStartX
        );


      panY =
        panBaseY +
        (
          touch.clientY -
          panStartY
        );


      clampPan();


      applyViewTransform();


      return;

    }


    /*
     * =====================================================
     * SWIPE
     * =====================================================
     */

    if (
      gestureMode !==
      "swipe" ||
      !swipeActive
    ) {

      return;

    }


    const dx =
      touch.clientX -
      swipeStartX;


    const dy =
      touch.clientY -
      swipeStartY;


    /*
     * 縦方向が明確なら
     * ページ送りを開始しない。
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
     * 横方向に少し動いたら
     * 方向だけ先に確定。
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
       * ページがない場合は
       * ページ送りしない。
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
       * 非同期で先読み。
       *
       * awaitしない。
       * 指の動きを止めない。
       */

      prepareIncoming(
        direction
      );

    }


    if (
      !swipeDirection
    ) {

      return;

    }


    /*
     * 逆方向に戻った場合は
     * その方向へページを変えない。
     */

    const currentDirection =
      dx < 0
        ? 1
        : -1;


    if (
      currentDirection !==
      swipeDirection
    ) {

      /*
       * まだ元のページ側へ
       * 戻していく。
       */

      if (
        incomingReady
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


      return;

    }


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
     * 次／前ページ。
     */

    if (
      incomingReady
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
    passive: false
  }
);


/* =========================================================
   Touch END
   ========================================================= */

stage.addEventListener(
  "touchend",
  async event => {

    /*
     * =====================================================
     * PINCH
     * =====================================================
     */

    if (
      gestureMode ===
      "pinch"
    ) {

      pinchStartDistance =
        0;


      gestureMode =
        "idle";


      swipeActive =
        false;


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

      /*
       * パン位置を維持。
       */

      gestureMode =
        "idle";


      swipeActive =
        false;


      return;

    }


    /*
     * =====================================================
     * SWIPE
     * =====================================================
     */

    if (
      gestureMode !==
      "swipe"
    ) {

      return;

    }


    swipeActive =
      false;


    const touch =
      event.changedTouches[0];


    const dx =
      touch.clientX -
      swipeStartX;


    const dy =
      touch.clientY -
      swipeStartY;


    /*
     * 横方向か。
     */

    const horizontal =
      Math.abs(dx) >
      Math.abs(dy) *
      SWIPE_AXIS_RATIO;


    /*
     * 最低距離。
     */

    const enough =
      Math.abs(dx) >=
      SWIPE_MIN_DISTANCE;


    /*
     * 明確なスワイプでない。
     */

    if (
      !horizontal ||
      !enough ||
      !swipeDirection
    ) {

      cancelSwipe();

      return;

    }


    /*
     * 次ページの準備が終わっていなければ
     * 最大1.5秒待つ。
     */

    if (
      !incomingReady
    ) {

      const started =
        performance.now();


      while (
        !incomingReady &&
        performance.now() -
          started <
          1500
      ) {

        await wait(16);

      }

    }


    if (
      !incomingReady
    ) {

      cancelSwipe();

      return;

    }


    /*
     * ページ確定。
     */

    await finishSwipe();

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch CANCEL
   ========================================================= */

stage.addEventListener(
  "touchcancel",
  () => {

    swipeActive =
      false;


    pinchStartDistance =
      0;


    gestureMode =
      "idle";


    swipeDirection =
      0;


    swipeCurrentX =
      0;


    swipeCurrentY =
      0;


    hideIncoming();


    applyViewTransform();

  },
  {
    passive: true
  }
);


/* =========================================================
   Cancel swipe
   ========================================================= */

function cancelSwipe() {

  /*
   * ページ送りをキャンセルしても
   * zoom / panは変更しない。
   */

  hideIncoming();


  applyViewTransform();


  swipeDirection =
    0;


  swipeActive =
    false;


  gestureMode =
    "idle";

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

    cancelSwipe();

    return;

  }


  pageChanging =
    true;


  try {

    await saveAnnotation();


    const width =
      stage.clientWidth;


    currentSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    incomingSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    /*
     * 現在ページを画面外へ。
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


    await wait(230);


    currentPage =
      target;


    await commitIncoming();

  }
  finally {

    pageChanging =
      false;


    swipeDirection =
      0;


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
   * incomingの論理サイズ。
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
   * 新しいページに入ったので
   * パンだけリセット。
   */

  resetPan();


  /*
   * ページ送り後は
   * zoomは1に戻す。
   */

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
   PDF high quality redraw
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


  /*
   * 基準サイズ。
   */

  const cssViewport =
    page.getViewport({

      scale:
        pdfBaseScale

    });


  /*
   * 実Canvas。
   */

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
        alpha: false
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
   Button page navigation
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
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    incomingSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


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


    await wait(230);


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
   Page buttons
   ========================================================= */

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
  value
) {

  viewerMode =
    value;


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

        viewerMode ===
        "pen"
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
      viewerMode !==
        "pen" &&
      viewerMode !==
        "eraser"
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
   Annotation DB
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
