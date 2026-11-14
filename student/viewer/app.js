
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

const $ =
  id =>
    document.getElementById(
      id
    );


const titleElement =
  $("title");

const pageElement =
  $("page");

const stage =
  $("stage");

const currentSlide =
  $("currentSlide");

const incomingSlide =
  $("incomingSlide");

const currentPdfCanvas =
  $("currentPdfCanvas");

const incomingPdfCanvas =
  $("incomingPdfCanvas");

const currentImage =
  $("currentImage");

const incomingImage =
  $("incomingImage");

const annotationCanvas =
  $("currentAnnotation");

const loadingOverlay =
  $("loadingOverlay");

const viewerMessage =
  $("viewerMessage");

const menuButton =
  $("menuButton");

const mobileMenu =
  $("mobileMenu");

const moveButton =
  $("move");

const penButton =
  $("pen");

const eraserButton =
  $("eraser");

const favoriteButton =
  $("favorite");

const zoomInButton =
  $("zoomIn");

const zoomOutButton =
  $("zoomOut");

const fitWidthButton =
  $("fitWidth");

const fitHeightButton =
  $("fitHeight");

const fullscreenButton =
  $("fullscreen");

const firstButton =
  $("first");

const previousButton =
  $("previous");

const nextButton =
  $("next");

const lastButton =
  $("last");

const printButton =
  $("print");

const closeButton =
  $("close");


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

let viewerMode = "move";

let gestureMode = "idle";


/* =========================================================
   Zoom
   ========================================================= */

const MIN_ZOOM = 1;

const MAX_ZOOM = 8;

const PAN_ZOOM_LIMIT = 1.03;

let zoom = 1;


/* =========================================================
   PDF
   ========================================================= */

let pdfBaseScale = 1;

const MAX_PDF_DPR = 3;


/* =========================================================
   Page
   ========================================================= */

let pageWidth = 0;

let pageHeight = 0;

let panX = 0;

let panY = 0;

let pageChanging = false;


/* =========================================================
   Swipe
   ========================================================= */

let dragStartX = 0;

let dragStartY = 0;

let dragX = 0;

let dragY = 0;

let dragDirection = 0;

let adjacentReady = false;

let adjacentPromise = null;


/* =========================================================
   Pointer
   ========================================================= */

const pointers =
  new Map();

let pinchStartDistance = 0;

let pinchStartZoom = 1;


/* =========================================================
   Render
   ========================================================= */

let renderToken = 0;

const imageCache =
  new Map();


/* =========================================================
   Pen
   ========================================================= */

const MAX_PEN_DPR = 4;

const PEN_WIDTH = 2.6;

const ERASER_WIDTH = 28;

let drawing = false;

let lastX = 0;

let lastY = 0;

let lastMidX = 0;

let lastMidY = 0;

let annotationDirty = false;


/* =========================================================
   Constants
   ========================================================= */

const PAGE_COMMIT_RATIO = 0.28;


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
      `教材ファイルを取得できませんでした: ${
        error.message || ""
      }`
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
   Account state
   ========================================================= */

/*
 * 停止中アカウントのモーダルはここでは出さない。
 *
 * 停止判定・停止モーダルはログイン画面側で行う。
 *
 * Viewerでは、
 * must_change_passwordだけを確認する。
 */

async function getStudentAccountState(
  studentId
) {

  const {
    data,
    error
  } =
    await supabase
      .from("users")
      .select(`
        id,
        role,
        status,
        must_change_password
      `)
      .eq(
        "id",
        studentId
      )
      .maybeSingle();


  if (error) {

    console.error(
      "ACCOUNT STATE ERROR:",
      error
    );

    throw new Error(
      "アカウント情報を確認できませんでした。"
    );

  }


  if (
    !data ||
    data.role !==
      "student"
  ) {

    throw new Error(
      "生徒アカウントを確認できません。"
    );

  }


  /*
   * 停止状態ならログイン画面側の
   * ガードに任せる。
   *
   * Viewerから直接開かれた場合だけ
   * 教材を表示しない。
   */

  if (
    data.status ===
    "suspended"
  ) {

    await supabase.auth.signOut();

    window.location.replace(
      "/student/login/"
    );

    return null;

  }


  return data;

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
      `Bookを取得できませんでした: ${
        error.message || ""
      }`
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
      "PDF.jsを正しく読み込めませんでした。"
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
        "PDFに表示できるページがありません。"
      );

    }

  }
  finally {

    hideLoading();

  }

}


/* =========================================================
   Image pages
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
        `教材ページを取得できませんでした: ${
          error.message
        }`
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
      pages.length ===
      0
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
   PDF size
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


async function getInitialPdfScale() {

  const size =
    await getPdfSize(
      currentPage
    );


  const availableWidth =
    Math.max(
      200,
      stage.clientWidth -
        48
    );


  const availableHeight =
    Math.max(
      200,
      stage.clientHeight -
        48
    );


  return Math.max(

    0.1,

    Math.min(

      availableWidth /
        size.width,

      availableHeight /
        size.height

    )

  );

}


/* =========================================================
   PDF render
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


  if (!context) {

    throw new Error(
      "PDF Canvasを取得できませんでした。"
    );

  }


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
   Slide transform
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

function getPointerDistance() {

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


function getPointerCenter() {

  const values =
    [...pointers.values()];


  if (
    values.length <
    2
  ) {

    return {

      x:
        stage.clientWidth /
        2,

      y:
        stage.clientHeight /
        2

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
   Pointer down
   ========================================================= */

stage.addEventListener(
  "pointerdown",
  event => {

    /*
     * ペン・消しゴム中は
     * annotationCanvas側で処理。
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
     * 2本指開始。
     */

    if (
      pointers.size >=
      2
    ) {

      gestureMode =
        "pinch";


      dragDirection =
        0;


      hideIncoming();


      pinchStartDistance =
        getPointerDistance();


      pinchStartZoom =
        zoom;


      return;

    }


    if (
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
   Pointer move
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
     * Pinch
     */

    if (
      gestureMode ===
        "pinch" &&
      pointers.size >=
        2
    ) {

      event.preventDefault();


      const distance =
        getPointerDistance();


      if (
        pinchStartDistance <=
        0
      ) {

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
     * 1本指ドラッグ。
     */

    if (
      gestureMode !==
        "drag" ||
      pointers.size !==
        1
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
     * 自由移動。
     *
     * zoomが1でも動かせる。
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
     * 横方向へ動いたら
     * ページ送り候補。
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
        adjacentReady
      ) {

        const startX =
          dragDirection >
            0
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
   Pointer up
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
     * Pinch終了。
     */

    if (
      gestureMode ===
      "pinch"
    ) {

      if (
        pointers.size >
        0
      ) {

        return;

      }


      gestureMode =
        "idle";


      pinchStartDistance =
        0;


      if (pdf) {

        await rerenderCurrentPdf();

      }


      return;

    }


    if (
      gestureMode !==
      "drag"
    ) {

      return;

    }


    if (
      pointers.size >
      0
    ) {

      return;

    }


    /*
     * ページ送り。
     */

    if (
      dragDirection !==
        0 &&
      adjacentReady
    ) {

      const threshold =
        Math.max(
          60,
          stage.clientWidth *
            PAGE_COMMIT_RATIO
        );


      if (
        Math.abs(dragX) >=
        threshold
      ) {

        await commitSwipe();

      }
      else {

        await cancelSwipe();

      }

    }
    else {

      /*
       * ページ送りではない場合は
       * 指を離した位置をそのまま維持。
       */

      panX +=
        dragX;


      panY +=
        dragY;


      clampPan();


      currentSlide.style.transition =
        "none";


      applyViewTransform();

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

  },
  {
    passive:
      true
  }
);


/* =========================================================
   Adjacent page
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
    target >
      getPageCount()
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


      applyIncomingTransform(

        direction >
          0
          ? stage.clientWidth
          : -stage.clientWidth,

        0

      );


      adjacentReady =
        true;


      return true;

    })()
      .catch(
        error => {

          console.error(
            "ADJACENT PAGE ERROR:",
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
   Commit swipe
   ========================================================= */

async function commitSwipe() {

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
    target >
      getPageCount()
  ) {

    await cancelSwipe();

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


    await wait(
      250
    );


    currentPage =
      target;


    await commitIncoming();

  }
  finally {

    pageChanging =
      false;

    dragDirection =
      0;

  }

}


/* =========================================================
   Cancel swipe
   ========================================================= */

async function cancelSwipe() {

  currentSlide.style.transition =
    "transform .20s cubic-bezier(.22,.61,.36,1)";


  incomingSlide.style.transition =
    "transform .20s cubic-bezier(.22,.61,.36,1)";


  applyViewTransform();


  const startX =
    dragDirection >
      0
      ? stage.clientWidth
      : -stage.clientWidth;


  applyIncomingTransform(
    startX,
    0
  );


  await wait(
    210
  );


  currentSlide.style.transition =
    "none";


  hideIncoming();


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
   PDF redraw
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
   Page navigation
   ========================================================= */

async function goToPage(
  target
) {

  if (
    pageChanging ||
    target < 1 ||
    target >
      getPageCount() ||
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


    await prepareTargetPage(

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
      0,
      0
    );


    await wait(
      250
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


async function prepareTargetPage(
  target,
  direction
) {

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


  applyIncomingTransform(

    direction >
      0
      ? stage.clientWidth
      : -stage.clientWidth,

    0

  );


  adjacentReady =
    true;


  return true;

}


/* =========================================================
   Page buttons
   ========================================================= */

firstButton?.addEventListener(
  "click",
  () =>
    goToPage(
      1
    )
);


previousButton?.addEventListener(
  "click",
  () =>
    goToPage(
      currentPage -
      1
    )
);


nextButton?.addEventListener(
  "click",
  () =>
    goToPage(
      currentPage +
      1
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

      zoom *
        1.15,

      stage.clientWidth /
        2,

      stage.clientHeight /
        2

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

      zoom /
        1.15,

      stage.clientWidth /
        2,

      stage.clientHeight /
        2

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
   Fit width
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


/* =========================================================
   Fit height
   ========================================================= */

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
    viewerMode ===
      "move"
  );


  penButton?.classList.toggle(
    "active",
    viewerMode ===
      "pen"
  );


  eraserButton?.classList.toggle(
    "active",
    viewerMode ===
      "eraser"
  );


  document.body.classList.toggle(
    "pen-enabled",
    viewerMode ===
      "pen"
  );


  document.body.classList.toggle(
    "eraser-enabled",
    viewerMode ===
      "eraser"
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
    setMode(
      "move"
    )
);


penButton?.addEventListener(
  "click",
  () =>
    setMode(
      viewerMode ===
        "pen"
        ? "move"
        : "pen"
    )
);


eraserButton?.addEventListener(
  "click",
  () =>
    setMode(
      "eraser"
    )
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
            action ===
            "first"
          ) {

            await goToPage(
              1
            );

          }
          else if (
            action ===
            "previous"
          ) {

            await goToPage(
              currentPage -
              1
            );

          }
          else if (
            action ===
            "next"
          ) {

            await goToPage(
              currentPage +
              1
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

            setMode(
              "move"
            );

          }
          else if (
            action ===
            "pen"
          ) {

            setMode(
              "pen"
            );

          }
          else if (
            action ===
            "eraser"
          ) {

            setMode(
              "eraser"
            );

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
            "print"
          ) {

            printButton?.click();

          }
          else if (
            action ===
            "fullscreen"
          ) {

            fullscreenButton?.click();

          }


          closeMenu();

        }
      );

    }
  );


/* =========================================================
   Annotation canvas
   ========================================================= */

function resizeAnnotationCanvas(
  width,
  height
) {

  const dpr =
    getPenDpr();


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

    old
      .getContext(
        "2d"
      )
      .drawImage(
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

    annotationCanvas
      .getContext(
        "2d"
      )
      .drawImage(

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


/* =========================================================
   Annotation point
   ========================================================= */

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


/* =========================================================
   Smooth pen
   ========================================================= */

function drawSmoothStroke(
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


  lastX =
    x;


  lastY =
    y;


  lastMidX =
    midX;


  lastMidY =
    midY;


  annotationDirty =
    true;

}


/* =========================================================
   Pen / eraser
   ========================================================= */

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


    event.preventDefault();

    event.stopPropagation();


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


    const dpr =
      getPenDpr();


    const context =
      annotationCanvas.getContext(
        "2d"
      );


    context.lineCap =
      "round";


    context.lineJoin =
      "round";


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
     * タップ時にも点を描く。
     */

    context.beginPath();


    context.arc(

      point.x,
      point.y,

      context.lineWidth /
        2,

      0,
      Math.PI *
        2

    );


    context.fillStyle =
      "#111";


    context.fill();


    annotationDirty =
      true;

  },
  {
    passive:
      false
  }
);


annotationCanvas.addEventListener(
  "pointermove",
  event => {

    if (!drawing) {
      return;
    }


    event.preventDefault();

    event.stopPropagation();


    const point =
      getAnnotationPoint(
        event
      );


    drawSmoothStroke(

      annotationCanvas.getContext(
        "2d"
      ),

      point.x,
      point.y

    );

  },
  {
    passive:
      false
  }
);


annotationCanvas.addEventListener(
  "pointerup",
  async event => {

    if (!drawing) {
      return;
    }


    event.preventDefault();

    event.stopPropagation();


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
    !student?.id
  ) {

    return;

  }


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

  if (
    !student?.id
  ) {

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
   Print
   ========================================================= */

printButton?.addEventListener(
  "click",
  openPrintDialog
);


function openPrintDialog() {

  document
    .getElementById(
      "viewerPrintDialog"
    )
    ?.remove();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "viewerPrintDialog";


  Object.assign(
    overlay.style,
    {

      position:
        "fixed",

      inset:
        "0",

      zIndex:
        "99990",

      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "20px",

      background:
        "rgba(0,0,0,.42)"

    }
  );


  overlay.innerHTML = `

    <div
      style="
        width:min(440px,100%);
        padding:26px;
        border-radius:12px;
        background:#fff;
        box-shadow:0 20px 60px rgba(0,0,0,.25);
      ">

      <h2
        style="
          margin:0 0 22px;
          font-size:19px;
        ">

        印刷

      </h2>


      <label
        style="
          display:flex;
          gap:9px;
          align-items:center;
          margin-bottom:13px;
          font-size:13px;
        ">

        <input
          type="radio"
          name="viewerPrintMode"
          value="current"
          checked>

        このページ

      </label>


      <label
        style="
          display:flex;
          gap:9px;
          align-items:center;
          font-size:13px;
        ">

        <input
          type="radio"
          name="viewerPrintMode"
          value="range">

        複数ページ

      </label>


      <input
        id="viewerPrintRange"
        type="text"
        placeholder="例：1-7、1,3,5-7"
        disabled
        style="
          width:100%;
          height:42px;
          margin-top:15px;
          padding:0 11px;
          border:1px solid #d5d9de;
          border-radius:7px;
          outline:none;
          font:inherit;
        ">


      <div
        id="viewerPrintError"
        style="
          display:none;
          margin-top:10px;
          color:#a12929;
          font-size:12px;
        ">
      </div>


      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:9px;
          margin-top:24px;
        ">

        <button
          id="viewerPrintCancel"
          type="button"
          style="
            height:40px;
            padding:0 15px;
            border:1px solid #d5d9de;
            border-radius:7px;
            background:#fff;
            cursor:pointer;
          ">

          キャンセル

        </button>


        <button
          id="viewerPrintStart"
          type="button"
          style="
            height:40px;
            padding:0 18px;
            border:0;
            border-radius:7px;
            background:#20252b;
            color:#fff;
            cursor:pointer;
          ">

          印刷

        </button>

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const rangeInput =
    $("viewerPrintRange");


  overlay
    .querySelectorAll(
      'input[name="viewerPrintMode"]'
    )
    .forEach(
      radio => {

        radio.addEventListener(
          "change",
          () => {

            rangeInput.disabled =
              radio.value !==
              "range";

          }
        );

      }
    );


  $("viewerPrintCancel")
    ?.addEventListener(
      "click",
      () =>
        overlay.remove()
    );


  $("viewerPrintStart")
    ?.addEventListener(
      "click",
      async () => {

        const errorElement =
          $("viewerPrintError");


        try {

          const mode =
            overlay.querySelector(
              'input[name="viewerPrintMode"]:checked'
            )?.value;


          const pageNumbers =
            mode ===
              "current"

              ? [
                  currentPage
                ]

              : parsePrintRange(
                  rangeInput.value
                );


          /*
           * ポップアップブロックを避けるため
           * クリック直後に開く。
           */

          const printWindow =
            window.open(
              "",
              "_blank"
            );


          if (!printWindow) {

            throw new Error(
              "印刷用タブを開けませんでした。ポップアップを許可してください。"
            );

          }


          overlay.remove();


          await createPrintDocument(

            printWindow,

            pageNumbers

          );

        }
        catch (error) {

          errorElement.textContent =
            error.message;


          errorElement.style.display =
            "block";

        }

      }
    );

}


function parsePrintRange(
  value
) {

  const text =
    String(
      value ||
      ""
    )
      .trim();


  if (!text) {

    throw new Error(
      "ページ範囲を入力してください。"
    );

  }


  const result =
    new Set();


  for (
    const part of text
      .split(",")
      .map(
        item =>
          item.trim()
      )
      .filter(
        Boolean
      )
  ) {

    const range =
      part.match(
        /^(\d+)\s*-\s*(\d+)$/
      );


    if (range) {

      const start =
        Number(
          range[1]
        );


      const end =
        Number(
          range[2]
        );


      if (
        start < 1 ||
        end >
          getPageCount() ||
        start >
          end
      ) {

        throw new Error(
          `ページは1〜${getPageCount()}で指定してください。`
        );

      }


      for (
        let page = start;
        page <= end;
        page++
      ) {

        result.add(
          page
        );

      }

      continue;

    }


    if (
      /^\d+$/.test(
        part
      )
    ) {

      const page =
        Number(
          part
        );


      if (
        page < 1 ||
        page >
          getPageCount()
      ) {

        throw new Error(
          `ページは1〜${getPageCount()}で指定してください。`
        );

      }


      result.add(
        page
      );

      continue;

    }


    throw new Error(
      "ページ範囲が正しくありません。例：1-7、1,3,5-7"
    );

  }


  return [
    ...result
  ].sort(
    (
      a,
      b
    ) =>
      a - b
  );

}


async function createPrintDocument(
  printWindow,
  pageNumbers
) {

  try {

    printWindow.document.open();


    printWindow.document.write(`

      <!doctype html>

      <html lang="ja">

      <head>

        <meta charset="UTF-8">

        <meta
          http-equiv="Content-Type"
          content="text/html; charset=UTF-8">

        <meta
          name="viewport"
          content="width=device-width,initial-scale=1">

        <title>印刷</title>

        <style>

          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .print-page {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            page-break-after: always;
          }

          .print-page:last-child {
            page-break-after: auto;
          }

          canvas,
          img {
            display: block;
            max-width: 100%;
            height: auto;
          }

        </style>

      </head>

      <body>

        <div id="loading">
          印刷ページを準備しています。
        </div>

      </body>

      </html>

    `);


    printWindow.document.close();


    const loading =
      printWindow.document
        .getElementById(
          "loading"
        );


    if (pdf) {

      for (
        const pageNumber of pageNumbers
      ) {

        loading.textContent =
          `${pageNumber} / ${getPageCount()} ページを準備しています。`;


        const page =
          await pdf.getPage(
            pageNumber
          );


        const baseViewport =
          page.getViewport({
            scale: 1
          });


        const cssWidth =
          794;


        const scale =
          cssWidth /
          baseViewport.width;


        const dpr =
          2;


        const cssViewport =
          page.getViewport({
            scale
          });


        const renderViewport =
          page.getViewport({
            scale:
              scale *
              dpr
          });


        const wrapper =
          printWindow.document
            .createElement(
              "div"
            );


        wrapper.className =
          "print-page";


        const canvas =
          printWindow.document
            .createElement(
              "canvas"
            );


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


        wrapper.appendChild(
          canvas
        );


        printWindow.document.body
          .appendChild(
            wrapper
          );


        const context =
          canvas.getContext(
            "2d",
            {
              alpha:
                false
            }
          );


        await page.render({

          canvasContext:
            context,

          viewport:
            renderViewport,

          intent:
            "print"

        }).promise;

      }

    }
    else {

      for (
        const pageNumber of pageNumbers
      ) {

        loading.textContent =
          `${pageNumber} / ${getPageCount()} ページを準備しています。`;


        const image =
          await getImage(
            pageNumber
          );


        const wrapper =
          printWindow.document
            .createElement(
              "div"
            );


        wrapper.className =
          "print-page";


        const img =
          printWindow.document
            .createElement(
              "img"
            );


        img.src =
          image.src;


        wrapper.appendChild(
          img
        );


        printWindow.document.body
          .appendChild(
            wrapper
          );

      }

    }


    loading.remove();


    printWindow.focus();


    setTimeout(
      () => {

        try {

          printWindow.print();

        }
        catch (
          error
        ) {

          console.error(
            "PRINT ERROR:",
            error
          );

        }

      },
      700
    );

  }
  catch (error) {

    console.error(
      "PRINT BUILD ERROR:",
      error
    );


    try {

      printWindow.close();

    }
    catch {}


    showMessage(
      error.message ||
      "印刷ページを作成できませんでした。"
    );

  }

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

  showLoading();


  try {

    /*
     * 認証・Bookアクセス確認。
     *
     * 停止アカウントのモーダルは
     * ログイン画面側で表示する。
     */

    student =
      await requireBookAccess(
        bookId
      );


    if (!student) {

      return;

    }


    /*
     * アカウント状態確認。
     */

    const account =
      await getStudentAccountState(
        student.id
      );


    if (!account) {

      return;

    }


    /*
     * 一時パスワード使用後。
     *
     * Viewerには入れない。
     */

    if (
      account.must_change_password ===
      true
    ) {

      window.location.replace(

        `/student/password-reset/?book=${
          encodeURIComponent(
            bookId
          )
        }`

      );


      return;

    }


    /*
     * Book取得。
     */

    const loaded =
      await loadBook();


    if (!loaded) {

      return;

    }


    /*
     * PDF / 画像。
     */

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
  catch (error) {

    console.error(
      "VIEWER ERROR:",
      error
    );


    showMessage(
      error?.message ||
      "教材を表示できませんでした。"
    );

  }
  finally {

    hideLoading();

  }

}


/* =========================================================
   Boot
   ========================================================= */

start()
  .catch(
    error => {

      console.error(
        "VIEWER BOOT ERROR:",
        error
      );


      hideLoading();


      showMessage(
        error?.message ||
        "教材を表示できませんでした。"
      );

    }
  );
