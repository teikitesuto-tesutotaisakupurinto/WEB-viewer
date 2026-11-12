
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
    location.search
  );

const bookId =
  params.get("book");


if (!bookId) {

  location.replace(
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
  document.getElementById(
    "title"
  );

const pageElement =
  document.getElementById(
    "page"
  );

const stage =
  document.getElementById(
    "stage"
  );

const currentSlide =
  document.getElementById(
    "currentSlide"
  );

const incomingSlide =
  document.getElementById(
    "incomingSlide"
  );

const currentPdfCanvas =
  document.getElementById(
    "currentPdfCanvas"
  );

const incomingPdfCanvas =
  document.getElementById(
    "incomingPdfCanvas"
  );

const currentImage =
  document.getElementById(
    "currentImage"
  );

const incomingImage =
  document.getElementById(
    "incomingImage"
  );

const annotationCanvas =
  document.getElementById(
    "currentAnnotation"
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

const moveButton =
  document.getElementById(
    "move"
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

let pdf = null;

let pdfjs = null;

let pages = [];

let currentPage = 1;

let zoom = 1;

let mode = "move";

let pageWidth = 0;

let pageHeight = 0;

let pageChanging = false;

let swipeActive = false;

let swipeDirection = 0;

let swipeStartX = 0;

let swipeStartY = 0;

let swipeDeltaX = 0;

let swipeStartTime = 0;

let pinchDistance = null;

let pinchStartZoom = 1;

let drawing = false;

let lastX = 0;

let lastY = 0;

let animationFrame = 0;

let renderToken = 0;

let pdfRenderScale = 1;

const imageCache =
  new Map();


/* =========================================================
   Message
   ========================================================= */

function showMessage(
  text
) {

  viewerMessage.textContent =
    text;

  viewerMessage.classList.remove(
    "hidden"
  );

}


function hideMessage() {

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
   PDF Page → Canvas
   ========================================================= */

async function renderPdfToCanvas(
  canvas,
  pageNumber
) {

  const page =
    await pdf.getPage(
      pageNumber
    );


  const viewport =
    page.getViewport({
      scale:
        pdfRenderScale
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
      viewport.width,

    height:
      viewport.height

  };

}


/* =========================================================
   Image取得
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
   Slide contents
   ========================================================= */

async function prepareCurrentPage() {

  const token =
    ++renderToken;


  currentPdfCanvas.style.display =
    "none";

  currentImage.style.display =
    "none";


  if (pdf) {

    const size =
      await renderPdfToCanvas(
        currentPdfCanvas,
        currentPage
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


  applyPageSize(
    currentSlide,
    pageWidth,
    pageHeight
  );


  applyScale();


  updatePageLabel();


  await loadAnnotation();

}


/* =========================================================
   Incoming Page
   ========================================================= */

async function prepareIncomingPage(
  pageNumber
) {

  incomingPdfCanvas.style.display =
    "none";

  incomingImage.style.display =
    "none";


  if (pdf) {

    const size =
      await renderPdfToCanvas(
        incomingPdfCanvas,
        pageNumber
      );


    incomingPdfCanvas.style.display =
      "block";


    applyPageSize(
      incomingSlide,
      size.width,
      size.height
    );

  }
  else {

    const image =
      await getImage(
        pageNumber
      );


    incomingImage.src =
      image.src;


    incomingImage.style.display =
      "block";


    applyPageSize(
      incomingSlide,
      image.naturalWidth,
      image.naturalHeight
    );

  }


  applyScaleToSlide(
    incomingSlide
  );

}


/* =========================================================
   Page size
   ========================================================= */

function applyPageSize(
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
   Scale
   ========================================================= */

function applyScaleToSlide(
  slide
) {

  const scale =
    zoom;


  slide.style.setProperty(
    "--page-scale",
    scale
  );

}


function applyScale() {

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


/* =========================================================
   Incoming position
   ========================================================= */

function positionIncoming(
  offset
) {

  incomingSlide.style.transform =
    `
      translate3d(
        calc(-50% + ${offset}px),
        -50%,
        0
      )
      scale(${zoom})
    `;

}


/* =========================================================
   Current position
   ========================================================= */

function positionCurrent(
  offset
) {

  currentSlide.style.transform =
    `
      translate3d(
        calc(-50% + ${offset}px),
        -50%,
        0
      )
      scale(${zoom})
    `;

}


/* =========================================================
   Reset
   ========================================================= */

function resetCurrentPosition() {

  currentSlide.style.transition =
    "none";

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


function hideIncoming() {

  incomingSlide.style.display =
    "none";

  incomingSlide.style.transition =
    "none";

  incomingSlide.style.transform =
    `
      translate3d(
        -50%,
        -50%,
        0
      )
      scale(${zoom})
    `;


  incomingPdfCanvas.style.display =
    "none";

  incomingImage.style.display =
    "none";

}


/* =========================================================
   Render
   ========================================================= */

async function renderCurrent() {

  resetCurrentPosition();

  hideIncoming();

  await prepareCurrentPage();

  applyScale();

}


/* =========================================================
   Adjacent preparation
   ========================================================= */

async function prepareAdjacent(
  direction
) {

  const target =
    currentPage + direction;


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


  /*
   * 次ページは右側、
   * 前ページは左側。
   */

  const startOffset =
    direction > 0
      ? stage.clientWidth
      : -stage.clientWidth;


  incomingSlide.style.transition =
    "none";


  positionIncoming(
    startOffset
  );


  return true;

}


/* =========================================================
   Swipe RAF
   ========================================================= */

function updateSwipeFrame() {

  animationFrame =
    0;


  if (
    !swipeActive
  ) {

    return;

  }


  /*
   * 現在ページは指と同じ距離だけ動く。
   */

  positionCurrent(
    swipeDeltaX
  );


  /*
   * incomingも同じ距離だけ動かす。
   */

  const screenWidth =
    stage.clientWidth;


  const incomingStart =
    swipeDirection > 0
      ? screenWidth
      : -screenWidth;


  positionIncoming(
    incomingStart +
    swipeDeltaX
  );

}


function requestSwipeFrame() {

  if (
    animationFrame
  ) {

    return;

  }


  animationFrame =
    requestAnimationFrame(
      updateSwipeFrame
    );

}


/* =========================================================
   Swipe Start
   ========================================================= */

async function startSwipe(
  x,
  y
) {

  if (
    mode !== "move" ||
    pageChanging ||
    swipeActive
  ) {

    return;

  }


  const targetDirection =
    x < stage.clientWidth / 2
      ? 1
      : -1;


  /*
   * これは「指を動かした方向」で決定するため、
   * 実際のdeltaはmove時に確定する。
   */

  swipeStartX =
    x;

  swipeStartY =
    y;

  swipeDeltaX =
    0;

  swipeDirection =
    0;

  swipeStartTime =
    Date.now();

  swipeActive =
    true;


  /*
   * 初期状態ではまだincomingを出さない。
   * 指が一定距離動いた時点で生成する。
   */

}


/* =========================================================
   Swipe Move
   ========================================================= */

async function moveSwipe(
  x,
  y
) {

  if (
    !swipeActive ||
    pageChanging
  ) {

    return;

  }


  const rawX =
    x -
    swipeStartX;


  const rawY =
    y -
    swipeStartY;


  /*
   * 縦移動が明らかに大きければ
   * ページめくりではない。
   */

  if (
    !swipeDirection &&
    Math.abs(rawY) >
    Math.abs(rawX)
  ) {

    return;

  }


  if (
    Math.abs(rawX) < 12
  ) {

    return;

  }


  /*
   * 左へ動く → 次ページ
   * 右へ動く → 前ページ
   */

  const direction =
    rawX < 0
      ? 1
      : -1;


  if (
    swipeDirection === 0
  ) {

    swipeDirection =
      direction;


    const target =
      currentPage +
      direction;


    if (
      target < 1 ||
      target > getPageCount()
    ) {

      /*
       * ページが存在しない方向では
       * 少しだけ抵抗感を出す。
       */

      swipeDeltaX =
        rawX * 0.18;

      requestSwipeFrame();

      return;

    }


    await prepareAdjacent(
      direction
    );

  }


  /*
   * 方向が途中で逆になった場合は
   * その方向へは追従させず、抵抗をかける。
   */

  if (
    direction !== swipeDirection
  ) {

    swipeDeltaX =
      rawX * 0.12;

  }
  else {

    swipeDeltaX =
      rawX;

  }


  requestSwipeFrame();

}


/* =========================================================
   Swipe End
   ========================================================= */

async function endSwipe(
  x,
  y
) {

  if (
    !swipeActive
  ) {

    return;

  }


  swipeActive =
    false;


  if (
    animationFrame
  ) {

    cancelAnimationFrame(
      animationFrame
    );

    animationFrame =
      0;

  }


  const deltaX =
    x -
    swipeStartX;


  const elapsed =
    Date.now() -
    swipeStartTime;


  /*
   * ページが存在しない方向
   */

  if (
    !swipeDirection ||
    (
      currentPage +
      swipeDirection <
      1
    ) ||
    (
      currentPage +
      swipeDirection >
      getPageCount()
    )
  ) {

    animateBack();

    return;

  }


  /*
   * 移動距離による確定判定
   */

  const threshold =
    Math.min(
      180,
      stage.clientWidth *
      0.28
    );


  const velocity =
    Math.abs(deltaX) /
    Math.max(
      1,
      elapsed
    );


  const shouldComplete =
    Math.abs(deltaX) >= threshold ||
    velocity >= 0.8;


  if (
    shouldComplete
  ) {

    await completeSwipe();

  }
  else {

    animateBack();

  }

}


/* =========================================================
   Cancel
   ========================================================= */

function animateBack() {

  currentSlide.style.transition =
    "transform .24s cubic-bezier(.22,.61,.36,1)";


  positionCurrent(
    0
  );


  if (
    incomingSlide.style.display !==
    "none"
  ) {

    const start =
      swipeDirection > 0
        ? stage.clientWidth
        : -stage.clientWidth;


    incomingSlide.style.transition =
      "transform .24s cubic-bezier(.22,.61,.36,1)";


    positionIncoming(
      start
    );


    setTimeout(
      () => {

        currentSlide.style.transition =
          "none";

        hideIncoming();

      },
      250
    );

  }
  else {

    setTimeout(
      () => {

        currentSlide.style.transition =
          "none";

      },
      250
    );

  }


  swipeDirection =
    0;

  swipeDeltaX =
    0;

}


/* =========================================================
   Complete
   ========================================================= */

async function completeSwipe() {

  pageChanging =
    true;


  try {

    const direction =
      swipeDirection;


    const target =
      currentPage +
      direction;


    if (
      target < 1 ||
      target > getPageCount()
    ) {

      animateBack();

      return;

    }


    const width =
      stage.clientWidth;


    /*
     * 現在ページを画面外へ。
     */

    currentSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    /*
     * 次/前ページを中央へ。
     */

    incomingSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    positionCurrent(
      direction > 0
        ? -width
        : width
    );


    positionIncoming(
      0
    );


    await wait(
      230
    );


    /*
     * ページ番号を確定。
     */

    currentPage =
      target;


    /*
     * incomingをcurrentへ移す。
     *
     * DOMを入れ替える代わりに
     * 内容をコピーして通常状態へ戻す。
     */

    await commitIncoming();


  }
  finally {

    pageChanging =
      false;

  }

}


/* =========================================================
   Commit
   ========================================================= */

async function commitIncoming() {

  /*
   * incomingの内容をcurrentへコピー。
   */

  if (pdf) {

    const source =
      incomingPdfCanvas;

    const target =
      currentPdfCanvas;


    target.width =
      source.width;

    target.height =
      source.height;


    const context =
      target.getContext(
        "2d"
      );


    context.clearRect(
      0,
      0,
      target.width,
      target.height
    );


    context.drawImage(
      source,
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
   * 現在ページのサイズを取得。
   */

  pageWidth =
    incomingSlide.offsetWidth /
    zoom;


  pageHeight =
    incomingSlide.offsetHeight /
    zoom;


  applyPageSize(
    currentSlide,
    pageWidth * zoom,
    pageHeight * zoom
  );


  /*
   * 通常位置へ。
   */

  currentSlide.style.transition =
    "none";


  currentSlide.style.transform =
    `
      translate3d(
        -50%,
        -50%,
        0
      )
      scale(${zoom})
    `;


  hideIncoming();


  /*
   * 注釈は新ページ。
   */

  resizeAnnotationCanvas(
    pageWidth * zoom,
    pageHeight * zoom
  );


  updatePageLabel();


  await loadAnnotation();

}


/* =========================================================
   Wait
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
   Touch
   ========================================================= */

stage.addEventListener(
  "touchstart",
  async event => {

    /*
     * Pinch
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


    const touch =
      event.touches[0];


    await startSwipe(
      touch.clientX,
      touch.clientY
    );

  },
  {
    passive: true
  }
);


stage.addEventListener(
  "touchmove",
  async event => {

    /*
     * Pinch zoom
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


      zoom =
        Math.max(
          0.25,
          Math.min(
            5,
            nextZoom
          )
        );


      /*
       * PDFを再描画しない。
       * CSS transformだけ更新。
       */

      applyScale();


      if (
        incomingSlide.style.display !==
        "none"
      ) {

        applyScaleToSlide(
          incomingSlide
        );


        positionIncoming(
          (
            swipeDirection > 0
              ? stage.clientWidth
              : -stage.clientWidth
          ) +
          swipeDeltaX
        );

      }


      return;

    }


    if (
      event.touches.length !== 1
    ) {

      return;

    }


    const touch =
      event.touches[0];


    await moveSwipe(
      touch.clientX,
      touch.clientY
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


      /*
       * 指を離した時だけ
       * 必要ならPDFを再描画。
       */

      if (pdf) {

        await rerenderCurrentPdf();

      }


      return;

    }


    const touch =
      event.changedTouches[0];


    await endSwipe(
      touch.clientX,
      touch.clientY
    );

  },
  {
    passive: true
  }
);


stage.addEventListener(
  "touchcancel",
  () => {

    pinchDistance =
      null;

    swipeActive =
      false;

    animateBack();

  },
  {
    passive: true
  }
);


/* =========================================================
   PDF zoom after gesture
   ========================================================= */

async function rerenderCurrentPdf() {

  if (!pdf) {
    return;
  }


  /*
   * 表示中Canvasを新しい倍率で再生成。
   * ピンチ中は実行しない。
   */

  const oldZoom =
    zoom;


  const baseWidth =
    pageWidth;


  const baseHeight =
    pageHeight;


  if (
    !baseWidth ||
    !baseHeight
  ) {

    return;

  }


  /*
   * 現在のページを高品質で再描画。
   */

  const page =
    await pdf.getPage(
      currentPage
    );


  const viewport =
    page.getViewport({
      scale:
        oldZoom
    });


  currentPdfCanvas.width =
    Math.ceil(
      viewport.width
    );


  currentPdfCanvas.height =
    Math.ceil(
      viewport.height
    );


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

    viewport,

    intent:
      "display"

  }).promise;


  pageWidth =
    viewport.width;


  pageHeight =
    viewport.height;


  applyPageSize(
    currentSlide,
    pageWidth,
    pageHeight
  );


  applyScale();


  resizeAnnotationCanvas(
    pageWidth,
    pageHeight
  );


  await loadAnnotation();

}


/* =========================================================
   Mouse wheel zoom
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


    const factor =
      event.deltaY > 0
        ? 0.92
        : 1.08;


    zoom =
      Math.max(
        0.25,
        Math.min(
          5,
          zoom * factor
        )
      );


    applyScale();

  },
  {
    passive: false
  }
);


/* =========================================================
   Buttons
   ========================================================= */

document.getElementById(
  "first"
).onclick =
  () =>
    goToPage(1);


document.getElementById(
  "previous"
).onclick =
  () =>
    goToPage(
      currentPage - 1
    );


document.getElementById(
  "next"
).onclick =
  () =>
    goToPage(
      currentPage + 1
    );


document.getElementById(
  "last"
).onclick =
  () =>
    goToPage(
      getPageCount()
    );


/* =========================================================
   Button page change
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


    await prepareAdjacent(
      direction
    );


    /*
     * ボタン操作でも
     * スライド式にする。
     */

    currentSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    incomingSlide.style.transition =
      "transform .22s cubic-bezier(.22,.61,.36,1)";


    const width =
      stage.clientWidth;


    positionCurrent(
      direction > 0
        ? -width
        : width
    );


    positionIncoming(
      0
    );


    await wait(
      230
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
   Zoom Buttons
   ========================================================= */

document.getElementById(
  "zoomIn"
).onclick =
  async () => {

    zoom =
      Math.min(
        5,
        zoom * 1.1
      );


    applyScale();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


document.getElementById(
  "zoomOut"
).onclick =
  async () => {

    zoom =
      Math.max(
        0.25,
        zoom / 1.1
      );


    applyScale();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


/* =========================================================
   Fit Width
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
        0.25,
        (
          stage.clientWidth -
          30
        ) /
        width
      );


    applyScale();


    if (pdf) {

      await rerenderCurrentPdf();

    }

  };


/* =========================================================
   Fit Height
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
        0.25,
        (
          stage.clientHeight -
          30
        ) /
        height
      );


    applyScale();


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
        error
      );

    }

  };


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


  /*
   * PDF
   */

  if (
    isPdfBook()
  ) {

    await loadPdf();

  }

  /*
   * 画像
   */

  else {

    await loadImagePages();

  }


  currentPage =
    1;


  /*
   * PDFは最初に1ページを
   * 高品質描画。
   */

  if (pdf) {

    pdfRenderScale =
      1;

  }


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
