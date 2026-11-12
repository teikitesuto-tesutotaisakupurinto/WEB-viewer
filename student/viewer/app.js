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

const pageContainer =
  document.getElementById(
    "pageContainer"
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
   共通メッセージ
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
   安全なテキスト
   ========================================================= */

function setText(
  element,
  value
) {

  if (!element) {
    return;
  }


  element.textContent =
    String(
      value || ""
    );

}


/* =========================================================
   Storage URL
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
   Book取得
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


  setText(
    titleElement,
    book.title
  );


  return true;

}


/* =========================================================
   Bookページ取得
   ========================================================= */

async function loadPages() {

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
        page =>
          page &&
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
      "このBookには表示できるページがありません。"
    );

  }


  /*
   * page_numberが欠落している古いデータでも
   * 配列上のページとして扱えるようにする。
   */

  pages =
    pages.map(
      (
        page,
        index
      ) => ({

        ...page,

        page_number:
          Number.isFinite(
            Number(
              page.page_number
            )
          )
            ? Number(
                page.page_number
              )
            : index + 1

      })
    );

}


/* =========================================================
   ページ数
   ========================================================= */

function getPageCount() {

  return pages.length;

}


/* =========================================================
   ページ表示
   ========================================================= */

function updatePageLabel() {

  setText(
    pageElement,
    `${currentPage} / ${getPageCount()}`
  );

}


/* =========================================================
   Canvasサイズ
   ========================================================= */

function resizeAnnotationCanvas(
  width,
  height
) {

  const safeWidth =
    Math.max(
      1,
      Math.round(width)
    );

  const safeHeight =
    Math.max(
      1,
      Math.round(height)
    );


  annotationCanvas.width =
    safeWidth;

  annotationCanvas.height =
    safeHeight;


  annotationCanvas.style.width =
    `${safeWidth}px`;

  annotationCanvas.style.height =
    `${safeHeight}px`;

}


/* =========================================================
   画像取得
   ========================================================= */

async function getImage(
  pageNumber
) {

  const cached =
    imageCache.get(
      pageNumber
    );


  if (cached) {

    return cached;

  }


  const page =
    pages[
      pageNumber - 1
    ];


  if (!page) {

    throw new Error(
      "指定されたページが見つかりません。"
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


  image.loading =
    "eager";


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
        () => resolve();


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
   ページ先読み
   ========================================================= */

async function preloadPage(
  pageNumber
) {

  if (
    pageNumber < 1 ||
    pageNumber > getPageCount()
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
      "PAGE PRELOAD ERROR:",
      error
    );

  }

}


/* =========================================================
   ページ描画
   ========================================================= */

async function renderPage() {

  const token =
    ++renderToken;


  const image =
    await getImage(
      currentPage
    );


  /*
   * 古い描画処理が後から帰ってきた場合は無視。
   */

  if (
    token !== renderToken
  ) {

    return;

  }


  const naturalWidth =
    Math.max(
      1,
      image.naturalWidth
    );


  const naturalHeight =
    Math.max(
      1,
      image.naturalHeight
    );


  const width =
    Math.max(
      1,
      Math.round(
        naturalWidth *
        zoom
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        naturalHeight *
        zoom
      )
    );


  /*
   * 画像
   */

  imagePage.src =
    image.src;


  imagePage.alt =
    book?.title
      ? `${book.title} ${currentPage}ページ`
      : "";


  imagePage.style.display =
    "block";


  imagePage.style.width =
    `${width}px`;


  imagePage.style.height =
    `${height}px`;


  /*
   * PDF Canvasが残っているHTMLにも対応。
   */

  const pdfCanvas =
    document.getElementById(
      "pdfCanvas"
    );


  if (pdfCanvas) {

    pdfCanvas.style.display =
      "none";

  }


  /*
   * ページコンテナ
   */

  pageContainer.style.width =
    `${width}px`;

  pageContainer.style.height =
    `${height}px`;


  /*
   * 書き込みCanvas
   */

  resizeAnnotationCanvas(
    width,
    height
  );


  updatePageLabel();


  /*
   * 現在ページの書き込み
   */

  await loadAnnotation();


  if (
    token !== renderToken
  ) {

    return;

  }


  /*
   * 前後ページを先読み。
   * 現在ページの表示を待たせない。
   */

  void preloadPage(
    currentPage + 1
  );

  void preloadPage(
    currentPage - 1
  );

}


/* =========================================================
   ページ移動
   ========================================================= */

async function changePage(
  nextPage
) {

  if (
    pageChanging
  ) {

    return;

  }


  const total =
    getPageCount();


  if (
    nextPage < 1 ||
    nextPage > total
  ) {

    return;

  }


  if (
    nextPage === currentPage
  ) {

    return;

  }


  pageChanging =
    true;


  try {

    await saveAnnotation();


    currentPage =
      nextPage;


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
   ページボタン
   ========================================================= */

const firstButton =
  document.getElementById(
    "first"
  );

if (firstButton) {

  firstButton.onclick =
    firstPage;

}


const previousButton =
  document.getElementById(
    "previous"
  );

if (previousButton) {

  previousButton.onclick =
    previousPage;

}


const nextButton =
  document.getElementById(
    "next"
  );

if (nextButton) {

  nextButton.onclick =
    nextPage;

}


const lastButton =
  document.getElementById(
    "last"
  );

if (lastButton) {

  lastButton.onclick =
    lastPage;

}


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


const zoomInButton =
  document.getElementById(
    "zoomIn"
  );

if (zoomInButton) {

  zoomInButton.onclick =
    () =>
      setZoom(
        zoom + 0.1
      );

}


const zoomOutButton =
  document.getElementById(
    "zoomOut"
  );

if (zoomOutButton) {

  zoomOutButton.onclick =
    () =>
      setZoom(
        zoom - 0.1
      );

}


/* =========================================================
   Fit Width
   ========================================================= */

async function fitWidth() {

  const image =
    await getImage(
      currentPage
    );


  const available =
    Math.max(
      100,
      stage.clientWidth - 56
    );


  await setZoom(
    available /
    image.naturalWidth
  );

}


const fitWidthButton =
  document.getElementById(
    "fitWidth"
  );

if (fitWidthButton) {

  fitWidthButton.onclick =
    fitWidth;

}


/* =========================================================
   Fit Height
   ========================================================= */

async function fitHeight() {

  const image =
    await getImage(
      currentPage
    );


  const available =
    Math.max(
      100,
      stage.clientHeight - 56
    );


  await setZoom(
    available /
    image.naturalHeight
  );

}


const fitHeightButton =
  document.getElementById(
    "fitHeight"
  );

if (fitHeightButton) {

  fitHeightButton.onclick =
    fitHeight;

}


/* =========================================================
   Fullscreen
   ========================================================= */

const fullscreenButton =
  document.getElementById(
    "fullscreen"
  );

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
      mode === "move"
    );

  }


  if (penButton) {

    penButton.classList.toggle(
      "active",
      mode === "pen"
    );


    penButton.textContent =
      mode === "pen"
        ? "ペン ON"
        : "ペン OFF";

  }


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


if (moveButton) {

  moveButton.onclick =
    () =>
      setMode(
        "move"
      );

}


if (penButton) {

  penButton.onclick =
    () =>
      setMode(
        mode === "pen"
          ? "move"
          : "pen"
      );

}


const eraserButton =
  document.getElementById(
    "eraser"
  );

if (eraserButton) {

  eraserButton.onclick =
    () =>
      setMode(
        "eraser"
      );

}


/* =========================================================
   Favorite
   ========================================================= */

const favoriteButton =
  document.getElementById(
    "favorite"
  );

if (favoriteButton) {

  favoriteButton.onclick =
    event => {

      event.currentTarget.classList.toggle(
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


  if (menuButton) {

    menuButton.setAttribute(
      "aria-expanded",
      "false"
    );

  }

}


if (menuButton && mobileMenu) {

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

              if (
                favoriteButton
              ) {

                favoriteButton.click();

              }

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

              await fitWidth();

            }
            else if (
              action === "fitHeight"
            ) {

              await fitHeight();

            }
            else if (
              action === "fullscreen"
            ) {

              if (
                fullscreenButton
              ) {

                fullscreenButton.click();

              }

            }


            closeMenu();

          };

      }
    );

}


/* =========================================================
   Swipe
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
        () => {

          renderPage();

        },
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


    const deltaX =
      touch.clientX -
      touchStartX;


    const deltaY =
      touch.clientY -
      touchStartY;


    const elapsed =
      Date.now() -
      touchStartTime;


    touchStartX =
      null;

    touchStartY =
      null;


    /*
     * 長押し
     */

    if (
      elapsed > 700
    ) {

      return;

    }


    /*
     * 横スワイプ判定
     */

    if (
      Math.abs(deltaX) < 70
    ) {

      return;

    }


    if (
      Math.abs(deltaX) <=
      Math.abs(deltaY)
    ) {

      return;

    }


    /*
     * 左 → 次
     * 右 → 前
     */

    if (
      deltaX < 0
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

    if (
      !drawing
    ) {

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


    /*
     * Viewerを別タブで開いた場合
     */

    if (
      window.opener &&
      !window.opener.closed
    ) {

      window.close();

      return;

    }


    /*
     * 同一タブの場合
     */

    window.location.replace(
      "../books/"
    );

  };


/* =========================================================
   起動
   ========================================================= */

async function start() {

  hideMessage();


  /*
   * 1.
   * ログイン + Student権限
   * 2.
   * このBookの利用権限
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
   * PDFも画像も
   * 最終的にはbook_pagesだけを見る。
   */

  await loadPages();


  /*
   * 表紙
   */

  currentPage =
    1;


  /*
   * 初期表示
   */

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
       * 権限エラーは
       * requireBookAccess側で処理済み。
       *
       * ここでは白画面にしない。
       */

      showMessage(
        error.message ||
        "教材を表示できませんでした。"
      );

    }
  );
