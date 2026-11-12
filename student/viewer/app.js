
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
  new URLSearchParams(location.search);

const bookId =
  params.get("book");


if (!bookId) {

  location.replace("/errors/?type=404");

  throw new Error("BOOK_ID_MISSING");

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
 * 表示倍率
 */

let zoom = 1;


/*
 * ページ本体の基準サイズ
 */

let pageWidth = 0;

let pageHeight = 0;


/*
 * パン位置
 *
 * 拡大中のみ使用。
 */

let panX = 0;

let panY = 0;

let panStartX = 0;

let panStartY = 0;

let panBaseX = 0;

let panBaseY = 0;


/*
 * ページ移動
 */

let pageChanging = false;


/*
 * スワイプ
 */

let swipeActive = false;

let swipeStartX = 0;

let swipeStartY = 0;

let swipeDeltaX = 0;

let swipeDirection = 0;

let swipeStartTime = 0;


/*
 * ピンチ
 */

let pinchDistance = null;

let pinchStartZoom = 1;

let pinchCenterX = 0;

let pinchCenterY = 0;


/*
 * 描画
 */

let drawing = false;

let lastX = 0;

let lastY = 0;


/*
 * PDF
 */

let renderToken = 0;

let pdfBaseScale = 1;


/*
 * Image cache
 */

const imageCache =
  new Map();


/* =========================================================
   Constants
   ========================================================= */

/*
 * これ以上拡大したら
 * ページ送りを完全停止。
 */

const PAN_ZOOM_LIMIT = 1.03;


/*
 * 通常時のページ送り最低距離。
 *
 * 小さな右移動では絶対に
 * ページを変えない。
 */

const SWIPE_MIN_DISTANCE = 120;


/*
 * 横方向が縦方向より
 * 明確に大きくなければ
 * ページ送りしない。
 */

const SWIPE_AXIS_RATIO = 1.6;


/*
 * ページ送り速度判定を使う場合も
 * 最低距離を必須にする。
 */

const SWIPE_MIN_TIME = 90;


/* =========================================================
   Message
   ========================================================= */

function showMessage(text) {

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

async function getSignedUrl(path) {

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
      "BOOK ERROR:",
      error
    );

    throw new Error(
      "Bookを取得できませんでした。"
    );

  }


  if (!data) {

    location.replace(
      "/errors/?type=404"
    );

    return false;

  }


  if (
    data.enabled === false
  ) {

    location.replace(
      "/errors/?type=book-forbidden"
    );

    return false;

  }


  book =
    data;


  titleElement.textContent =
    book.title || "";


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
   PDF
   ========================================================= */

async function loadPdf() {

  if (!book.file_path) {

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


  hideMessage();

}


/* =========================================================
   Image Book
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
        (a, b) =>
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
   Page count
   ========================================================= */

function getPageCount() {

  return pdf
    ? pdf.numPages
    : pages.length;

}


function updatePageLabel() {

  pageElement.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   Image
   ========================================================= */

async function getImage(pageNumber) {

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
        image.naturalWidth
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
   High DPI PDF scale
   ========================================================= */

function getPdfRenderScale() {

  const dpr =
    Math.min(
      2.5,
      Math.max(
        1,
        window.devicePixelRatio || 1
      )
    );


  /*
   * 表示幅から基準倍率を作る。
   */

  const viewportWidth =
    Math.max(
      1,
      stage.clientWidth - 40
    );


  /*
   * PDF 1ページを取得する。
   */

  return pdf
    .getPage(
      currentPage
    )
    .then(
      page => {

        const base =
          page.getViewport({
            scale: 1
          });


        const fit =
          viewportWidth /
          base.width;


        return Math.max(
          1,
          fit * dpr
        );

      }
    );

}


/* =========================================================
   PDF render
   ========================================================= */

async function renderPdfCanvas(
  canvas,
  pageNumber,
  qualityScale
) {

  const page =
    await pdf.getPage(
      pageNumber
    );


  const viewport =
    page.getViewport({
      scale:
        qualityScale
    });


  canvas.width =
    Math.ceil(
      viewport.width
    );


  canvas.height =
    Math.ceil(
      viewport.height
    );


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

    viewport,

    intent:
      "display"

  }).promise;


  return {

    width:
      viewport.width /
      qualityScale,

    height:
      viewport.height /
      qualityScale

  };

}


/* =========================================================
   Current page preparation
   ========================================================= */

async function prepareCurrentPage() {

  const token =
    ++renderToken;


  currentPdfCanvas.style.display =
    "none";

  currentImage.style.display =
    "none";


  if (pdf) {

    /*
     * 高DPI。
     */

    pdfBaseScale =
      await getPdfRenderScale();


    if (
      token !== renderToken
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
      token !== renderToken
    ) {
      return;
    }


    pageWidth =
      size.width;

    pageHeight =
      size.height;


    currentPdfCanvas.style.display =
      "block";

  }
  else {

    const image =
      await getImage(
        currentPage
      );


    if (
      token !== renderToken
    ) {
      return;
    }


    pageWidth =
      image.naturalWidth;

    pageHeight =
      image.naturalHeight;


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
   Incoming
   ========================================================= */

async function prepareIncomingPage(
  pageNumber
) {

  incomingPdfCanvas.style.display =
    "none";

  incomingImage.style.display =
    "none";


  if (pdf) {

    /*
     * 次ページも高画質で準備。
     */

    const size =
      await renderPdfCanvas(

        incomingPdfCanvas,

        pageNumber,

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
        pageNumber
      );


    setSlideSize(
      incomingSlide,
      image.naturalWidth,
      image.naturalHeight
    );


    incomingImage.src =
      image.src;


    incomingImage.style.display =
      "block";

  }

}


/* =========================================================
   Slide size
   ========================================================= */

function setSlideSize(
  slide,
  width,
  height
) {

  slide.style.width =
    `${width}px`;

  slide.style.height =
    `${height}px`;

}


/* =========================================================
   View transform
   ========================================================= */

function applyViewTransform() {

  currentSlide.style.transform =
    `
      translate3d(
        calc(-50% + ${panX}px),
        calc(-50% + ${panY}px),
        0
      )
      scale(${zoom})
    `;

}


/* =========================================================
   Incoming transform
   ========================================================= */

function applyIncomingTransform(
  offsetX
) {

  incomingSlide.style.transform =
    `
      translate3d(
        calc(-50% + ${offsetX}px),
        -50%,
        0
      )
      scale(${zoom})
    `;

}


/* =========================================================
   Pan limit
   ========================================================= */

function getPanLimits() {

  const viewportWidth =
    stage.clientWidth;

  const viewportHeight =
    stage.clientHeight;


  const scaledWidth =
    pageWidth *
    zoom;

  const scaledHeight =
    pageHeight *
    zoom;


  return {

    x:
      Math.max(
        0,
        (
          scaledWidth -
          viewportWidth
        ) / 2
      ),

    y:
      Math.max(
        0,
        (
          scaledHeight -
          viewportHeight
        ) / 2
      )

  };

}


/* =========================================================
   Clamp pan
   ========================================================= */

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


/* =========================================================
   Reset pan
   ========================================================= */

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
  centerX = stage.clientWidth / 2,
  centerY = stage.clientHeight / 2
) {

  const oldZoom =
    zoom;


  const nextZoom =
    Math.max(
      1,
      Math.min(
        4,
        value
      )
    );


  if (
    oldZoom === nextZoom
  ) {

    return;

  }


  /*
   * 拡大中心を維持。
   */

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
   Adjacent
   ========================================================= */

async function prepareAdjacent(
  direction
) {

  const target =
    currentPage +
    direction;


  if (
    target < 1 ||
    target > getPageCount()
  ) {

    return false;

  }


  await prepareIncomingPage(
    target
  );


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


  return true;

}


/* =========================================================
   Hide incoming
   ========================================================= */

function hideIncoming() {

  incomingSlide.style.display =
    "none";


  incomingSlide.style.transition =
    "none";


  incomingPdfCanvas.style.display =
    "none";


  incomingImage.style.display =
    "none";

}


/* =========================================================
   Render current
   ========================================================= */

async function renderCurrent() {

  hideIncoming();


  await prepareCurrentPage();

}


/* =========================================================
   Wait
   ========================================================= */

function wait(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );

}


/* =========================================================
   Swipe
   ========================================================= */

stage.addEventListener(
  "touchstart",
  async event => {

    /*
     * Pinch開始
     */

    if (
      event.touches.length === 2
    ) {

      swipeActive =
        false;


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
      event.touches.length !== 1
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


    swipeDeltaX =
      0;


    swipeDirection =
      0;


    swipeStartTime =
      Date.now();


    /*
     * 拡大中はページ送りではなく
     * 自由パン。
     */

    if (
      zoom > PAN_ZOOM_LIMIT
    ) {

      panStartX =
        touch.clientX;

      panStartY =
        touch.clientY;

      panBaseX =
        panX;

      panBaseY =
        panY;


      swipeActive =
        false;


      return;

    }


    swipeActive =
      true;

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch move
   ========================================================= */

stage.addEventListener(
  "touchmove",
  async event => {

    /*
     * Pinch
     */

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


      const nextZoom =
        pinchStartZoom *
        distance /
        pinchDistance;


      applyZoom(
        nextZoom,
        (
          a.clientX +
          b.clientX
        ) / 2,
        (
          a.clientY +
          b.clientY
        ) / 2
      );


      return;

    }


    if (
      event.touches.length !== 1
    ) {

      return;

    }


    const touch =
      event.touches[0];


    /*
     * =====================================================
     * 拡大中
     * =====================================================
     */

    if (
      zoom > PAN_ZOOM_LIMIT
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
     * 通常倍率
     * ページめくり
     * =====================================================
     */

    if (
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
     * 縦方向が強い場合は
     * ページめくりしない。
     */

    if (
      !swipeDirection &&
      Math.abs(dy) >
      Math.abs(dx)
    ) {

      return;

    }


    if (
      Math.abs(dx) < 12
    ) {

      return;

    }


    const direction =
      dx < 0
        ? 1
        : -1;


    /*
     * ページ方向確定。
     */

    if (
      !swipeDirection
    ) {

      swipeDirection =
        direction;


      const target =
        currentPage +
        direction;


      /*
       * その方向にページがない場合、
       * ページめくり自体を開始しない。
       */

      if (
        target < 1 ||
        target > getPageCount()
      ) {

        swipeDirection =
          0;

        swipeDeltaX =
          dx * 0.12;

        return;

      }


      await prepareAdjacent(
        direction
      );

    }


    /*
     * 途中で逆方向へ戻した場合。
     *
     * そのまま別ページへ切り替えない。
     */

    if (
      direction !==
      swipeDirection
    ) {

      swipeDeltaX =
        dx * 0.08;

    }
    else {

      swipeDeltaX =
        dx;

    }


    /*
     * 現在ページと次ページを
     * 指に完全追従。
     */

    currentSlide.style.transform =
      `
        translate3d(
          calc(-50% + ${swipeDeltaX}px),
          -50%,
          0
        )
        scale(${zoom})
      `;


    const incomingStart =
      swipeDirection > 0
        ? stage.clientWidth
        : -stage.clientWidth;


    applyIncomingTransform(
      incomingStart +
      swipeDeltaX
    );

  },
  {
    passive: false
  }
);


/* =========================================================
   Touch end
   ========================================================= */

stage.addEventListener(
  "touchend",
  async event => {

    /*
     * Pinch終了
     */

    if (
      pinchDistance !== null
    ) {

      pinchDistance =
        null;


      /*
       * 高画質再描画はここだけ。
       */

      if (pdf) {

        await rerenderCurrentPdf();

      }


      return;

    }


    /*
     * 拡大中はパン終了。
     * 絶対にページ送りしない。
     */

    if (
      zoom > PAN_ZOOM_LIMIT
    ) {

      return;

    }


    if (
      !swipeActive
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


    const elapsed =
      Date.now() -
      swipeStartTime;


    /*
     * 縦方向ならキャンセル。
     */

    if (
      Math.abs(dy) >=
      Math.abs(dx) *
      0.625
    ) {

      animateSwipeBack();

      return;

    }


    /*
     * 最低距離。
     *
     * これ未満なら絶対に
     * ページ移動しない。
     */

    if (
      Math.abs(dx) <
      SWIPE_MIN_DISTANCE
    ) {

      animateSwipeBack();

      return;

    }


    /*
     * 速度だけでページ送りしない。
     *
     * 必ず距離条件を満たす。
     */

    if (
      elapsed <
      SWIPE_MIN_TIME &&
      Math.abs(dx) <
      SWIPE_MIN_DISTANCE
    ) {

      animateSwipeBack();

      return;

    }


    if (
      !swipeDirection
    ) {

      animateSwipeBack();

      return;

    }


    await completeSwipe();

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch cancel
   ========================================================= */

stage.addEventListener(
  "touchcancel",
  () => {

    pinchDistance =
      null;


    swipeActive =
      false;


    animateSwipeBack();

  },
  {
    passive: true
  }
);


/* =========================================================
   Swipe cancel
   ========================================================= */

function animateSwipeBack() {

  currentSlide.style.transition =
    "transform .22s cubic-bezier(.22,.61,.36,1)";


  currentSlide.style.transform =
    `
      translate3d(
        -50%,
        -50%,
        0
      )
      scale(${zoom})
    `;


  if (
    incomingSlide.style.display !==
    "none"
  ) {

    const start =
      swipeDirection > 0
        ? stage.clientWidth
        : -stage.clientWidth;


    incomingSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    applyIncomingTransform(
      start
    );


    setTimeout(
      () => {

        currentSlide.style.transition =
          "none";

        hideIncoming();

      },
      240
    );

  }


  swipeDirection =
    0;

  swipeDeltaX =
    0;

}


/* =========================================================
   Swipe complete
   ========================================================= */

async function completeSwipe() {

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

    animateSwipeBack();

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


    await wait(
      240
    );


    currentPage =
      target;


    await commitIncoming();

  }
  finally {

    pageChanging =
      false;

    swipeDirection =
      0;

    swipeDeltaX =
      0;

  }

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


    const context =
      currentPdfCanvas
        .getContext(
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


    pageWidth =
      incomingSlide.offsetWidth /
      zoom;


    pageHeight =
      incomingSlide.offsetHeight /
      zoom;

  }
  else {

    currentImage.src =
      incomingImage.src;


    currentImage.style.display =
      "block";


    currentPdfCanvas.style.display =
      "none";


    pageWidth =
      incomingSlide.offsetWidth /
      zoom;


    pageHeight =
      incomingSlide.offsetHeight /
      zoom;

  }


  setSlideSize(
    currentSlide,
    pageWidth,
    pageHeight
  );


  resetPan();


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


  /*
   * 現在の倍率で高DPI描画。
   */

  const dpr =
    Math.min(
      2.5,
      Math.max(
        1,
        window.devicePixelRatio || 1
      )
    );


  const page =
    await pdf.getPage(
      currentPage
    );


  const viewport =
    page.getViewport({
      scale:
        zoom *
        dpr
    });


  currentPdfCanvas.width =
    Math.ceil(
      viewport.width
    );


  currentPdfCanvas.height =
    Math.ceil(
      viewport.height
    );


  currentPdfCanvas.style.width =
    `${viewport.width / dpr}px`;


  currentPdfCanvas.style.height =
    `${viewport.height / dpr}px`;


  const context =
    currentPdfCanvas
      .getContext(
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

    viewport,

    intent:
      "display"

  }).promise;


  pageWidth =
    viewport.width /
    dpr;


  pageHeight =
    viewport.height /
    dpr;


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
   Button navigation
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


  /*
   * ボタン操作はページ送りを明示的に
   * 指定しているため、ズーム中でも許可。
   */

  pageChanging =
    true;


  try {

    await saveAnnotation();


    const direction =
      target >
      currentPage
        ? 1
        : -1;


    const prepared =
      await prepareAdjacent(
        direction
      );


    if (!prepared) {
      return;
    }


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


    await wait(
      240
    );


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
   Zoom buttons
   ========================================================= */

document.getElementById(
  "zoomIn"
).onclick =
  async () => {

    applyZoom(
      zoom * 1.15
    );


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


document.getElementById(
  "zoomOut"
).onclick =
  async () => {

    applyZoom(
      zoom / 1.15
    );


    if (
      zoom <= PAN_ZOOM_LIMIT
    ) {

      resetPan();

      applyViewTransform();

    }


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


/* =========================================================
   Fit width
   ========================================================= */

document.getElementById(
  "fitWidth"
).onclick =
  async () => {

    let width;


    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      width =
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


      width =
        image.naturalWidth;

    }


    zoom =
      Math.max(
        1,
        (
          stage.clientWidth -
          30
        ) /
        width
      );


    resetPan();

    applyViewTransform();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


/* =========================================================
   Fit height
   ========================================================= */

document.getElementById(
  "fitHeight"
).onclick =
  async () => {

    let height;


    if (pdf) {

      const page =
        await pdf.getPage(
          currentPage
        );


      height =
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


      height =
        image.naturalHeight;

    }


    zoom =
      Math.max(
        1,
        (
          stage.clientHeight -
          30
        ) /
        height
      );


    resetPan();

    applyViewTransform();


    if (pdf) {

      await rerenderCurrentPdf();

    }

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
  value
) {

  mode =
    value;

  drawing =
    false;

  updateMode();

}


moveButton.onclick =
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

            document
              .getElementById(
                "zoomIn"
              )
              .click();

          }
          else if (
            action === "zoomOut"
          ) {

            document
              .getElementById(
                "zoomOut"
              )
              .click();

          }
          else if (
            action === "fitWidth"
          ) {

            document
              .getElementById(
                "fitWidth"
              )
              .click();

          }
          else if (
            action === "fitHeight"
          ) {

            document
              .getElementById(
                "fitHeight"
              )
              .click();

          }
          else if (
            action === "fullscreen"
          ) {

            document
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
   Mouse drag for desktop
   ========================================================= */

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


stage.addEventListener(
  "mousedown",
  event => {

    if (
      mode !== "move" ||
      zoom <= PAN_ZOOM_LIMIT
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

    if (
      !mouseDown
    ) {

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

    if (
      !drawing
    ) {

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
   Resize
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      zoom <= PAN_ZOOM_LIMIT
    ) {

      resetPan();

    }


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


start()
.catch(
  error => {

    console.error(
      "VIEWER ERROR:",
      error
    );


    showMessage(
      error.message ||
      "教材を表示できませんでした。"
    );

  }
);
