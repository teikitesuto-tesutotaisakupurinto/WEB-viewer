import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


const student =
  await requireStudent();


if (!student) {
  throw new Error(
    "Unauthorized"
  );
}


const params =
  new URLSearchParams(
    location.search
  );


const bookId =
  params.get("book");


if (!bookId) {

  location.replace(
    "../books/"
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

const container =
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


/* =========================================================
   State
   ========================================================= */

let book = null;

let pdf = null;

let pages = [];

let currentPage = 1;

let zoom = 1;

let penEnabled = false;

let tool = null;

let drawing = false;

let lastX = 0;

let lastY = 0;


/*
 * スワイプ
 */

let touchStartX =
  null;

let touchStartY =
  null;

let touchStartTime =
  0;


/*
 * ピンチ
 */

let pinchDistance =
  null;

let pinchStartZoom =
  1;


/*
 * 画像先読み
 */

const imageCache =
  new Map();


/* =========================================================
   Storage URL
   ========================================================= */

async function getSignedUrl(
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
        file_path,
        file_type,
        enabled
      `)
      .eq(
        "id",
        bookId
      )
      .eq(
        "enabled",
        true
      )
      .maybeSingle();


  if (
    error ||
    !data
  ) {

    throw new Error(
      "Bookを取得できませんでした。"
    );

  }


  book =
    data;


  title.textContent =
    book.title;

}


/* =========================================================
   利用権限確認
   ========================================================= */

async function checkLicense() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(
        "id"
      )
      .eq(
        "book_id",
        bookId
      )
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "status",
        "used"
      )
      .maybeSingle();


  if (
    error ||
    !data
  ) {

    throw new Error(
      "このBookを利用する権限がありません。"
    );

  }

}


/* =========================================================
   PDF読み込み
   ========================================================= */

async function loadPdf() {

  const url =
    await getSignedUrl(
      book.file_path
    );


  const pdfjs =
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
    );


  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


  pdf =
    await pdfjs
      .getDocument({
        url
      })
      .promise;

}


/* =========================================================
   画像ページ取得
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


  if (
    error ||
    !data?.length
  ) {

    throw new Error(
      "教材ページが登録されていません。"
    );

  }


  pages =
    data;

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


/* =========================================================
   ページ表示
   ========================================================= */

function updatePageLabel() {

  pageLabel.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   Annotation Canvas
   ========================================================= */

function setupAnnotationCanvas(
  width,
  height
) {

  annotationCanvas.width =
    Math.floor(
      width
    );


  annotationCanvas.height =
    Math.floor(
      height
    );


  annotationCanvas.style.width =
    `${width}px`;


  annotationCanvas.style.height =
    `${height}px`;

}


/* =========================================================
   PDF描画
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


  container.style.width =
    `${viewport.width}px`;


  container.style.height =
    `${viewport.height}px`;


  pdfCanvas.style.display =
    "block";


  imagePage.style.display =
    "none";


  await page.render({

    canvasContext:
      pdfCanvas.getContext(
        "2d"
      ),

    viewport

  }).promise;


  setupAnnotationCanvas(
    viewport.width,
    viewport.height
  );


  updatePageLabel();


  await loadAnnotation();


  /*
   * 次ページを先読み
   */

  preloadPdfPage(
    currentPage + 1
  );

}


/* =========================================================
   PDF先読み
   ========================================================= */

async function preloadPdfPage(
  pageNumber
) {

  if (
    !pdf ||
    pageNumber < 1 ||
    pageNumber > pdf.numPages
  ) {

    return;

  }


  try {

    await pdf.getPage(
      pageNumber
    );

  }
  catch {}

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

      image.onload =
        resolve;

      image.onerror =
        () => reject(
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
   画像描画
   ========================================================= */

async function renderImage() {

  /*
   * 現在ページを取得
   */

  const image =
    await getImage(
      currentPage
    );


  const width =
    Math.floor(
      image.naturalWidth *
      zoom
    );


  const height =
    Math.floor(
      image.naturalHeight *
      zoom
    );


  /*
   * 画像を表示
   */

  imagePage.src =
    image.src;


  imagePage.style.width =
    `${width}px`;


  imagePage.style.height =
    `${height}px`;


  imagePage.style.display =
    "block";


  pdfCanvas.style.display =
    "none";


  container.style.width =
    `${width}px`;


  container.style.height =
    `${height}px`;


  setupAnnotationCanvas(
    width,
    height
  );


  updatePageLabel();


  await loadAnnotation();


  /*
   * 前後ページを先読み
   *
   * これでスワイプした瞬間に
   * 次画像を表示しやすくする
   */

  preloadImage(
    currentPage + 1
  );


  preloadImage(
    currentPage - 1
  );

}


/* =========================================================
   画像先読み
   ========================================================= */

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
  catch {}

}


/* =========================================================
   Render
   ========================================================= */

async function render() {

  if (pdf) {

    await renderPdf();

    return;

  }


  await renderImage();

}


/* =========================================================
   ページ移動
   ========================================================= */

async function goPrevious() {

  if (
    currentPage <= 1
  ) {

    return;

  }


  await saveAnnotation();


  currentPage--;


  await render();

}


async function goNext() {

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


/* =========================================================
   ボタン
   ========================================================= */

document.getElementById(
  "previous"
).onclick =
  goPrevious;


document.getElementById(
  "next"
).onclick =
  goNext;


/* =========================================================
   ペン
   ========================================================= */

function updatePenState() {

  penButton.textContent =
    penEnabled
      ? "ペン ON"
      : "ペン OFF";


  penButton.classList.toggle(
    "active",
    penEnabled
  );


  document.body.classList.toggle(
    "pen-enabled",
    penEnabled
  );

}


penButton.onclick =
  () => {

    penEnabled =
      !penEnabled;


    tool =
      penEnabled
        ? "pen"
        : null;


    drawing =
      false;


    updatePenState();

  };


/* =========================================================
   蛍光ペン
   ========================================================= */

document.getElementById(
  "highlighter"
).onclick =
  () => {

    penEnabled =
      true;

    tool =
      "highlighter";

    updatePenState();

  };


/* =========================================================
   消しゴム
   ========================================================= */

document.getElementById(
  "eraser"
).onclick =
  () => {

    penEnabled =
      true;

    tool =
      "eraser";

    updatePenState();

  };


/* =========================================================
   消去
   ========================================================= */

document.getElementById(
  "clear"
).onclick =
  async () => {

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


    await saveAnnotation();

  };


/* =========================================================
   タッチ開始
   ========================================================= */

stage.addEventListener(
  "touchstart",
  event => {

    /*
     * 2本指
     * → ピンチズーム
     */

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


    /*
     * ペン中は
     * ページスワイプしない
     */

    if (
      penEnabled
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


/* =========================================================
   タッチ移動
   ========================================================= */

stage.addEventListener(
  "touchmove",
  event => {

    /*
     * ピンチズーム
     */

    if (
      event.touches.length === 2 &&
      pinchDistance !== null
    ) {

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
          .5,

          Math.min(
            4,

            Number(
              (
                pinchStartZoom *
                distance /
                pinchDistance
              ).toFixed(2)
            )
          )
        );


      clearTimeout(
        window.__viewerZoomTimer
      );


      window.__viewerZoomTimer =
        setTimeout(
          () => {

            render();

          },
          80
        );


      return;

    }

  },
  {
    passive: false
  }
);


/* =========================================================
   タッチ終了
   ========================================================= */

stage.addEventListener(
  "touchend",
  async event => {

    /*
     * ピンチ終了
     */

    if (
      pinchDistance !== null
    ) {

      pinchDistance =
        null;

      return;

    }


    /*
     * ペン中
     */

    if (
      penEnabled
    ) {

      touchStartX =
        null;

      touchStartY =
        null;

      return;

    }


    if (
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
     * 縦スクロールを
     * 横スワイプと誤認しない
     */

    if (
      elapsed > 700
    ) {

      return;

    }


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
     * 左へスワイプ
     * → 次画像
     */

    if (
      deltaX < 0
    ) {

      await goNext();

    }


    /*
     * 右へスワイプ
     * → 前画像
     */

    else {

      await goPrevious();

    }

  }
);


/* =========================================================
   PCホイールズーム
   ========================================================= */

stage.addEventListener(
  "wheel",
  event => {

    /*
     * Ctrl + ホイール
     */

    if (
      !event.ctrlKey
    ) {

      return;

    }


    event.preventDefault();


    zoom =
      Math.max(

        .5,

        Math.min(

          4,

          Number(
            (
              zoom +
              (
                event.deltaY > 0
                  ? -.1
                  : .1
              )
            ).toFixed(2)
          )

        )

      );


    clearTimeout(
      window.__viewerWheelTimer
    );


    window.__viewerWheelTimer =
      setTimeout(
        () => {

          render();

        },
        80
      );

  },
  {
    passive: false
  }
);


/* =========================================================
   ペン描画
   ========================================================= */

annotationCanvas.addEventListener(
  "pointerdown",
  event => {

    if (
      !penEnabled
    ) {

      return;

    }


    drawing =
      true;


    annotationCanvas
      .setPointerCapture(
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
      !drawing ||
      !penEnabled
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
      tool ===
      "highlighter"
    ) {

      context.lineWidth =
        18;

      context.strokeStyle =
        "rgba(255,235,0,.45)";

      context.globalCompositeOperation =
        "source-over";

    }
    else if (
      tool ===
      "eraser"
    ) {

      context.lineWidth =
        28;

      context.globalCompositeOperation =
        "destination-out";

    }
    else {

      context.lineWidth =
        3;

      context.strokeStyle =
        "#111";

      context.globalCompositeOperation =
        "source-over";

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


/* =========================================================
   Annotation保存
   ========================================================= */

async function saveAnnotation() {

  if (
    !annotationCanvas.width
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

    console.error(
      "ANNOTATION SAVE ERROR:",
      error
    );

  }

}


/* =========================================================
   Annotation読み込み
   ========================================================= */

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


  if (
    !data?.annotation_data?.image
  ) {

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
    data.annotation_data.image;

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
     * My Booksから開いた別タブなら
     * このViewerタブを閉じる
     */

    if (
      window.opener &&
      !window.opener.closed
    ) {

      window.close();

      return;

    }


    history.back();

  };


/* =========================================================
   キーボード
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.target.tagName ===
        "INPUT" ||
      event.target.tagName ===
        "TEXTAREA"
    ) {

      return;

    }


    if (
      event.key ===
      "ArrowLeft"
    ) {

      goPrevious();

    }


    if (
      event.key ===
      "ArrowRight"
    ) {

      goNext();

    }

  }
);


/* =========================================================
   起動
   ========================================================= */

async function start() {

  updatePenState();


  await loadBook();


  await checkLicense();


  /*
   * PDF
   */

  if (
    String(
      book.file_type || ""
    ).toLowerCase() ===
    "pdf"
  ) {

    await loadPdf();

  }


  /*
   * 画像Book
   */

  else {

    await loadImagePages();

  }


  await render();

}


start()
  .catch(
    error => {

      console.error(
        "VIEWER ERROR:",
        error
      );


      document.body.innerHTML = `

        <div class="page-error">

          <h2>
            Viewerを読み込めませんでした
          </h2>

          <p>
            ${String(
              error.message ||
              "予期しないエラーが発生しました。"
            ).replace(
              /[<>&"]/g,
              ""
            )}
          </p>

          <button
            type="button"
            onclick="history.back()">

            戻る

          </button>

        </div>

      `;

    }
  );
