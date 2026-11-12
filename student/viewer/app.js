
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

let viewerMode = "move";

let interactionMode = "idle";

let pageWidth = 0;

let pageHeight = 0;

let panX = 0;

let panY = 0;

let panStartX = 0;

let panStartY = 0;

let panBaseX = 0;

let panBaseY = 0;

let pageChanging = false;

let swipeStartX = 0;

let swipeStartY = 0;

let swipeDeltaX = 0;

let swipeDirection = 0;

let swipeActive = false;

let pinchDistance = null;

let pinchStartZoom = 1;

let drawing = false;

let lastX = 0;

let lastY = 0;

let renderToken = 0;

const imageCache =
  new Map();


/* =========================================================
   Constants
   ========================================================= */

const PAN_ZOOM_LIMIT =
  1.03;

const SWIPE_MIN_DISTANCE =
  120;

const SWIPE_AXIS_RATIO =
  1.6;

const MAX_DPR =
  2.5;


/* =========================================================
   Loading
   PDFだけでなく画像Bookにも使用
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
   PDF読み込み
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
          withCredentials: false
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
   PDF Size
   ========================================================= */

async function getPdfSize(
  pageNumber
) {

  const page =
    await pdf.getPage(
      pageNumber
    );


  const viewport =
    page.getViewport({
      scale: 1
    });


  return {

    width:
      viewport.width,

    height:
      viewport.height

  };

}


function getDpr() {

  return Math.min(
    MAX_DPR,
    Math.max(
      1,
      window.devicePixelRatio || 1
    )
  );

}


/* =========================================================
   PDF Canvas
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
   Initial PDF scale
   ========================================================= */

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


/* =========================================================
   Current Page
   ========================================================= */

async function prepareCurrentPage() {

  const token =
    ++renderToken;


  currentPdfCanvas.style.display =
    "none";


  currentImage.style.display =
    "none";


  if (pdf) {

    const scale =
      await getInitialPdfScale();


    if (
      token !== renderToken
    ) {

      return;

    }


    const size =
      await renderPdfCanvas(

        currentPdfCanvas,

        currentPage,

        scale

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
      token !== renderToken
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
          .1,
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
   重要：renderCurrent
   ========================================================= */

async function renderCurrent() {

  hideIncoming();


  await prepareCurrentPage();


  updatePageLabel();


  applyViewTransform();

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

    const currentSize =
      await getPdfSize(
        currentPage
      );


    const scale =
      pageWidth /
      currentSize.width;


    const size =
      await renderPdfCanvas(

        incomingPdfCanvas,

        pageNumber,

        scale

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


    const ratio =
      pageWidth /
      Math.max(
        1,
        currentImage.naturalWidth
      );


    setSlideSize(

      incomingSlide,

      image.naturalWidth * ratio,

      image.naturalHeight * ratio

    );


    incomingImage.src =
      image.src;


    incomingImage.style.display =
      "block";

  }

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
        calc(-50% + ${panX}px),
        calc(-50% + ${panY}px),
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
        calc(-50% + ${offsetX}px),
        -50%,
        0
      )
      scale(${zoom})
    `;

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
          pageWidth * zoom -
          stage.clientWidth
        ) / 2
      ),

    y:
      Math.max(
        0,

        (
          pageHeight * zoom -
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
   Incoming
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
   Pinch
   ========================================================= */

function getTouchDistance(
  touches
) {

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


function beginPinch(
  touches
) {

  interactionMode =
    "pinch";


  swipeActive =
    false;


  swipeDirection =
    0;


  pinchDistance =
    getTouchDistance(
      touches
    );


  pinchStartZoom =
    zoom;


  hideIncoming();

}


function updatePinch(
  touches
) {

  if (
    pinchDistance === null ||
    touches.length < 2
  ) {

    return;

  }


  const distance =
    getTouchDistance(
      touches
    );


  if (
    distance <= 0
  ) {

    return;

  }


  const center =
    getTouchCenter(
      touches
    );


  applyZoom(

    pinchStartZoom *
    distance /
    pinchDistance,

    center.x,
    center.y

  );

}


async function endPinch() {

  pinchDistance =
    null;


  interactionMode =
    "idle";


  if (pdf) {

    await rerenderCurrentPdf();

  }

}


/* =========================================================
   Touch Start
   ========================================================= */

stage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length === 2
    ) {

      beginPinch(
        event.touches
      );

      return;

    }


    if (
      event.touches.length !== 1 ||
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
      performance.now();


    if (
      zoom > PAN_ZOOM_LIMIT
    ) {

      interactionMode =
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


    interactionMode =
      "undecided";


    swipeActive =
      true;

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch Move
   ========================================================= */

stage.addEventListener(
  "touchmove",
  async event => {

    if (
      event.touches.length === 2
    ) {

      event.preventDefault();


      if (
        interactionMode !==
        "pinch"
      ) {

        beginPinch(
          event.touches
        );

      }


      updatePinch(
        event.touches
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
     * 拡大中は完全に自由パン。
     */

    if (
      interactionMode ===
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
     * 横方向が明確になるまで
     * ページ送りを開始しない。
     */

    if (
      interactionMode ===
      "undecided"
    ) {

      if (
        Math.abs(dy) >
        Math.abs(dx) *
        SWIPE_AXIS_RATIO
      ) {

        interactionMode =
          "neutral";


        return;

      }


      if (
        Math.abs(dx) >= 24 &&
        Math.abs(dx) >
        Math.abs(dy) *
        SWIPE_AXIS_RATIO
      ) {

        const direction =
          dx < 0
            ? 1
            : -1;


        const target =
          currentPage +
          direction;


        if (
          target < 1 ||
          target > getPageCount()
        ) {

          interactionMode =
            "neutral";


          return;

        }


        interactionMode =
          "page-turn";


        swipeDirection =
          direction;


        await prepareAdjacent(
          direction
        );

      }

    }


    if (
      interactionMode !==
      "page-turn"
    ) {

      return;

    }


    event.preventDefault();


    swipeDeltaX =
      dx;


    currentSlide.style.transform =
      `
        translate3d(
          calc(-50% + ${dx}px),
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
      dx
    );

  },
  {
    passive: false
  }
);


/* =========================================================
   Touch End
   ========================================================= */

stage.addEventListener(
  "touchend",
  async event => {

    if (
      interactionMode ===
      "pinch"
    ) {

      await endPinch();

      return;

    }


    /*
     * パンは位置維持。
     */

    if (
      interactionMode ===
      "pan"
    ) {

      interactionMode =
        "idle";

      return;

    }


    if (
      interactionMode !==
      "page-turn"
    ) {

      swipeActive =
        false;


      interactionMode =
        "idle";


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


    const horizontal =
      Math.abs(dx) >
      Math.abs(dy) *
      SWIPE_AXIS_RATIO;


    const enough =
      Math.abs(dx) >=
      SWIPE_MIN_DISTANCE;


    if (
      !horizontal ||
      !enough
    ) {

      keepCurrentPositionAndCancel();

      return;

    }


    await completePageTurn();

  },
  {
    passive: true
  }
);


/* =========================================================
   Touch Cancel
   ========================================================= */

stage.addEventListener(
  "touchcancel",
  () => {

    swipeActive =
      false;


    pinchDistance =
      null;


    interactionMode =
      "idle";


    hideIncoming();


    applyViewTransform();

  },
  {
    passive: true
  }
);


/* =========================================================
   Cancel
   ========================================================= */

function keepCurrentPositionAndCancel() {

  hideIncoming();


  applyViewTransform();


  swipeDirection =
    0;


  swipeDeltaX =
    0;


  interactionMode =
    "idle";

}


/* =========================================================
   Page turn
   ========================================================= */

async function completePageTurn() {

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

    keepCurrentPositionAndCancel();

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


    swipeDeltaX =
      0;


    interactionMode =
      "idle";

  }

}


/* =========================================================
   Commit
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
    incomingSlide.offsetWidth /
    zoom;


  pageHeight =
    incomingSlide.offsetHeight /
    zoom;


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


/* =========================================================
   Zoom buttons
   ========================================================= */

document.getElementById(
  "zoomIn"
).onclick =
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


document.getElementById(
  "zoomOut"
).onclick =
  async () => {

    applyZoom(

      zoom / 1.12,

      stage.clientWidth / 2,

      stage.clientHeight / 2

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
   Fit Width
   ========================================================= */

document.getElementById(
  "fitWidth"
).onclick =
  async () => {

    let width;


    if (pdf) {

      const size =
        await getPdfSize(
          currentPage
        );


      width =
        size.width;

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
        .25,
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
   Fit Height
   ========================================================= */

document.getElementById(
  "fitHeight"
).onclick =
  async () => {

    let height;


    if (pdf) {

      const size =
        await getPdfSize(
          currentPage
        );


      height =
        size.height;

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
        .25,
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
    viewerMode === "move"
  );


  penButton.classList.toggle(
    "active",
    viewerMode === "pen"
  );


  penButton.textContent =
    viewerMode === "pen"
      ? "ペン ON"
      : "ペン OFF";


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


moveButton.onclick =
  () =>
    setMode("move");


penButton.onclick =
  () =>
    setMode(
      viewerMode === "pen"
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
   Desktop pan
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
      viewerMode !== "move" ||
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
      viewerMode === "eraser"
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
   Wait
   ========================================================= */

function wait(
  milliseconds
) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );

}


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
   * Image Book
   */

  else {

    await loadImagePages();

  }


  currentPage =
    1;


  updateMode();


  /*
   * ここで必ず定義済みの
   * renderCurrent() を呼ぶ。
   */

  await renderCurrent();

}


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
