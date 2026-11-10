import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


/* =========================================================
   Student
   ========================================================= */

const student =
  await requireStudent();


if (!student) {
  throw new Error(
    "ログインしてください。"
  );
}


/* =========================================================
   Book ID
   ========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );


const bookId =
  params.get("book");


if (!bookId) {

  throw new Error(
    "Bookが指定されていません。"
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


/* ペン */

let penEnabled = false;

let tool = "pen";

let drawing = false;

let lastX = 0;

let lastY = 0;


/* タッチ */

let touchStartX = null;

let touchStartY = null;

let touchStartTime = 0;


/* ピンチ */

let pinchDistance = null;

let pinchZoom = 1;


/* 画像キャッシュ */

const imageCache =
  new Map();


/* =========================================================
   Storage URL
   ========================================================= */

async function getFileUrl(
  path
) {

  if (!path) {

    throw new Error(
      "教材ファイルのパスがありません。"
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

    throw new Error(
      "教材ファイルを取得できませんでした: " +
      error.message
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
      "Book取得エラー: " +
      error.message
    );

  }


  if (!data) {

    throw new Error(
      "Bookが見つかりません。"
    );

  }


  if (!data.enabled) {

    throw new Error(
      "このBookは現在公開されていません。"
    );

  }


  book =
    data;


  titleElement.textContent =
    book.title || "Book";

}


/* =========================================================
   License確認
   ========================================================= */

async function checkLicense() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(
        "id,status"
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


  if (error) {

    throw new Error(
      "利用権限の確認に失敗しました: " +
      error.message
    );

  }


  if (!data) {

    throw new Error(
      "このBookはまだ登録されていません。"
    );

  }

}


/* =========================================================
   PDF読み込み
   ========================================================= */

async function loadPdfBook() {

  if (!book.file_path) {

    throw new Error(
      "PDFファイルが登録されていません。"
    );

  }


  const url =
    await getFileUrl(
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


  if (
    !pdf.numPages
  ) {

    throw new Error(
      "PDFにページがありません。"
    );

  }

}


/* =========================================================
   画像Book読み込み
   ========================================================= */

async function loadImageBook() {

  const {
    data,
    error
  } =
    await supabase
      .from("book_pages")
      .select(`
        id,
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

    throw new Error(
      "Bookページ取得エラー: " +
      error.message
    );

  }


  if (
    !data ||
    data.length === 0
  ) {

    throw new Error(
      "このBookには画像ページが登録されていません。"
    );

  }


  /*
   * ページ番号を念のため整理
   */

  pages =
    data
      .filter(
        page =>
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
      "表示可能なページがありません。"
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


/* =========================================================
   ページ表示
   ========================================================= */

function updatePageLabel() {

  pageElement.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/* =========================================================
   Canvasサイズ
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
   PDF表示
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


  pageContainer.style.width =
    `${viewport.width}px`;


  pageContainer.style.height =
    `${viewport.height}px`;


  pdfCanvas.style.display =
    "block";


  imagePage.style.display =
    "none";


  const context =
    pdfCanvas.getContext(
      "2d"
    );


  context.clearRect(
    0,
    0,
    pdfCanvas.width,
    pdfCanvas.height
  );


  await page.render({

    canvasContext:
      context,

    viewport

  }).promise;


  resizeAnnotationCanvas(
    viewport.width,
    viewport.height
  );


  updatePageLabel();


  await loadAnnotation();


  /*
   * 次ページを先読み
   */

  if (
    currentPage <
    pdf.numPages
  ) {

    pdf.getPage(
      currentPage + 1
    ).catch(
      () => {}
    );

  }

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
      `ページ ${pageNumber} が見つかりません。`
    );

  }


  const url =
    await getFileUrl(
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
        () => {

          reject(
            new Error(
              `ページ ${pageNumber} の画像を読み込めませんでした。`
            )
          );

        };

    }
  );


  imageCache.set(
    pageNumber,
    image
  );


  return image;

}


/* =========================================================
   画像表示
   ========================================================= */

async function renderImage() {

  const image =
    await getImage(
      currentPage
    );


  if (
    !image.naturalWidth ||
    !image.naturalHeight
  ) {

    throw new Error(
      "画像サイズを取得できませんでした。"
    );

  }


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
   * img要素に直接セット
   */

  imagePage.src =
    image.src;


  imagePage.alt =
    `${book.title} ${currentPage}ページ`;


  imagePage.style.width =
    `${width}px`;


  imagePage.style.height =
    `${height}px`;


  imagePage.style.display =
    "block";


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


  /*
   * 前後ページ先読み
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
  catch (
    error
  ) {

    console.warn(
      "PRELOAD ERROR:",
      error
    );

  }

}


/* =========================================================
   Render
   ========================================================= */

async function renderPage() {

  if (pdf) {

    await renderPdf();

  }
  else {

    await renderImage();

  }

}


/* =========================================================
   次ページ
   ========================================================= */

async function nextPage() {

  const total =
    getPageCount();


  if (
    currentPage >= total
  ) {

    return;

  }


  await saveAnnotation();


  currentPage += 1;


  await renderPage();

}


/* =========================================================
   前ページ
   ========================================================= */

async function previousPage() {

  if (
    currentPage <= 1
  ) {

    return;

  }


  await saveAnnotation();


  currentPage -= 1;


  await renderPage();

}


/* =========================================================
   ボタン
   ========================================================= */

document.getElementById(
  "previous"
).onclick =
  previousPage;


document.getElementById(
  "next"
).onclick =
  nextPage;


/* =========================================================
   ペン
   ========================================================= */

function updatePen() {

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
      "pen";


    updatePen();

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

    updatePen();

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

    updatePen();

  };


/* =========================================================
   全消去
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
     * ピンチ
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


      pinchZoom =
        zoom;


      return;

    }


    /*
     * ペン中はスワイプしない
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
            pinchZoom *
            distance /
            pinchDistance
          )
        );


      clearTimeout(
        window.__zoomTimer
      );


      window.__zoomTimer =
        setTimeout(
          () => {

            renderPage();

          },
          80
        );

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

    if (
      pinchDistance !== null
    ) {

      pinchDistance =
        null;

      return;

    }


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
     * 長押しは無視
     */

    if (
      elapsed > 700
    ) {

      return;

    }


    /*
     * 横方向でなければ無視
     */

    if (
      Math.abs(deltaX) < 70 ||
      Math.abs(deltaX) <=
        Math.abs(deltaY)
    ) {

      return;

    }


    /*
     * 左 → 次
     */

    if (
      deltaX < 0
    ) {

      await nextPage();

    }

    /*
     * 右 → 前
     */

    else {

      await previousPage();

    }

  }
);


/* =========================================================
   PCズーム
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
      window.__wheelTimer
    );


    window.__wheelTimer =
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

    if (!drawing) {
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
      "ANNOTATION ERROR:",
      error
    );

  }

}


/* =========================================================
   Annotation読み込み
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


  const imageData =
    data?.annotation_data?.image;


  if (!imageData) {
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
    imageData;

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

      previousPage();

    }


    if (
      event.key ===
      "ArrowRight"
    ) {

      nextPage();

    }

  }
);


/* =========================================================
   起動
   ========================================================= */

async function start() {

  updatePen();


  /*
   * 1. Book
   */

  await loadBook();


  /*
   * 2. 利用権限
   */

  await checkLicense();


  /*
   * 3. 中身
   */

  const type =
    String(
      book.file_type || ""
    ).toLowerCase();


  if (
    type === "pdf"
  ) {

    await loadPdfBook();

  }
  else {

    /*
     * images
     * jpg
     * jpeg
     * png
     * など全部画像Bookとして扱う
     */

    await loadImageBook();

  }


  /*
   * 4. 最初のページ
   */

  currentPage =
    1;


  await renderPage();

}


start()
  .catch(
    error => {

      console.error(
        "VIEWER ERROR:",
        error
      );


      document.body.innerHTML = `

        <div
          class="page-error">

          <h2>
            Bookを表示できませんでした
          </h2>

          <p>
            ${String(
              error.message ||
              "教材の読み込みに失敗しました。"
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
