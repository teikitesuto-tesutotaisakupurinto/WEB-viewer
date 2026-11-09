
import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


/*
 * Student認証
 */

const student =
  await requireStudent();


if (!student) {

  throw new Error(
    "Unauthorized"
  );

}


/*
 * URL
 */

const params =
  new URLSearchParams(
    location.search
  );


const bookId =
  params.get("book");


if (!bookId) {

  alert(
    "Bookが指定されていません。"
  );

  location.replace(
    "../"
  );

  throw new Error(
    "Book ID missing"
  );

}


/*
 * DOM
 */

const titleElement =
  document.getElementById(
    "title"
  );

const pageElement =
  document.getElementById(
    "page"
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

const pageContainer =
  document.getElementById(
    "pageContainer"
  );

const viewerStage =
  document.getElementById(
    "viewerStage"
  );

const penButton =
  document.getElementById(
    "pen"
  );


/*
 * 状態
 */

let book = null;

let pdf = null;

let imagePages = [];

let currentPage = 1;

let zoom = 1;

let penEnabled = false;

let tool = "pen";

let drawing = false;

let lastX = 0;

let lastY = 0;

let rendering = false;


/*
 * ピンチズーム
 */

let pinchStartDistance = null;

let pinchStartZoom = 1;


/*
 * スワイプ
 */

let swipeStartX = null;

let swipeStartY = null;


/*
 * ズーム描画予約
 */

let zoomRenderTimer = null;


/*
 * PDF判定
 */

let isPdf = false;


/*
 * Book取得
 */

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
      .eq(
        "enabled",
        true
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

    throw new Error(
      "Bookが見つかりません。"
    );

  }


  book =
    data;


  titleElement.textContent =
    book.title;


  isPdf =
    String(
      book.file_type || ""
    ).toLowerCase() ===
    "pdf";

}


/*
 * 利用権確認
 */

async function checkLicense() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        book_id,
        student_id,
        status
      `)
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

    console.error(
      "LICENSE ERROR:",
      error
    );

    throw new Error(
      "Bookの利用権を確認できませんでした。"
    );

  }


  if (!data) {

    throw new Error(
      "このBookを利用する権限がありません。"
    );

  }

}


/*
 * Storage署名URL
 */

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
      "SIGNED URL ERROR:",
      error
    );

    throw new Error(
      "教材ファイルを取得できませんでした。"
    );

  }


  if (
    !data ||
    !data.signedUrl
  ) {

    throw new Error(
      "教材ファイルのURLを取得できませんでした。"
    );

  }


  return data.signedUrl;

}


/*
 * PDF読み込み
 */

async function loadPdf() {

  const url =
    await getSignedUrl(
      book.file_path
    );


  const pdfjs =
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
    );


  if (
    pdfjs.GlobalWorkerOptions
  ) {

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

  }


  pdf =
    await pdfjs
      .getDocument({
        url
      })
      .promise;


  currentPage =
    Math.min(
      currentPage,
      pdf.numPages
    );


  await renderPdfPage();

}


/*
 * 画像Book読み込み
 */

async function loadImages() {

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

    console.error(
      "BOOK PAGES ERROR:",
      error
    );

    throw new Error(
      "教材ページを取得できませんでした。"
    );

  }


  if (
    !data ||
    data.length === 0
  ) {

    throw new Error(
      "教材ページが登録されていません。"
    );

  }


  imagePages =
    data;


  currentPage =
    Math.min(
      currentPage,
      imagePages.length
    );


  await renderImagePage();

}


/*
 * ページ数
 */

function getPageCount() {

  if (isPdf) {

    return pdf
      ? pdf.numPages
      : 0;

  }


  return imagePages.length;

}


/*
 * ページ情報
 */

function updatePageInfo() {

  pageElement.textContent =
    `${currentPage} / ${getPageCount()}`;

}


/*
 * Annotation Canvas
 */

function setupAnnotationCanvas(
  width,
  height
) {

  annotationCanvas.width =
    Math.floor(width);

  annotationCanvas.height =
    Math.floor(height);


  annotationCanvas.style.width =
    `${width}px`;

  annotationCanvas.style.height =
    `${height}px`;

}


/*
 * PDF描画
 */

async function renderPdfPage() {

  if (
    !pdf ||
    rendering
  ) {

    return;

  }


  rendering =
    true;


  try {

    const page =
      await pdf.getPage(
        currentPage
      );


    const viewport =
      page.getViewport({
        scale: zoom
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


    const context =
      pdfCanvas.getContext(
        "2d",
        {
          alpha: false
        }
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


    pdfCanvas.style.display =
      "block";

    imagePage.style.display =
      "none";


    setupAnnotationCanvas(
      viewport.width,
      viewport.height
    );


    updatePageInfo();


    await loadAnnotation();

  }
  finally {

    rendering =
      false;

  }

}


/*
 * 画像描画
 */

async function renderImagePage() {

  const page =
    imagePages[
      currentPage - 1
    ];


  if (!page) {

    throw new Error(
      "教材ページが見つかりません。"
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


  await new Promise(
    (
      resolve,
      reject
    ) => {

      image.onload =
        resolve;

      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );

      image.src =
        url;

    }
  );


  const width =
    Math.max(
      1,
      Math.floor(
        image.naturalWidth *
        zoom
      )
    );


  const height =
    Math.max(
      1,
      Math.floor(
        image.naturalHeight *
        zoom
      )
    );


  imagePage.src =
    url;


  imagePage.width =
    width;

  imagePage.height =
    height;


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


  setupAnnotationCanvas(
    width,
    height
  );


  updatePageInfo();


  await loadAnnotation();

}


/*
 * 初期表示
 */

async function render() {

  if (isPdf) {

    if (!pdf) {

      await loadPdf();

      return;

    }


    await renderPdfPage();

    return;

  }


  if (
    imagePages.length === 0
  ) {

    await loadImages();

    return;

  }


  await renderImagePage();

}


/*
 * ペン状態
 */

function updatePenButton() {

  if (!penButton) {
    return;
  }


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


  viewerStage.classList.toggle(
    "swipe-enabled",
    !penEnabled
  );

}


/*
 * ペンON/OFF
 */

penButton.onclick = () => {

  penEnabled =
    !penEnabled;


  tool =
    penEnabled
      ? "pen"
      : null;


  drawing =
    false;


  updatePenButton();

};


/*
 * 蛍光ペン
 */

document.getElementById(
  "highlighter"
).onclick = () => {

  penEnabled =
    true;

  tool =
    "highlighter";

  drawing =
    false;

  updatePenButton();

};


/*
 * 消しゴム
 */

document.getElementById(
  "eraser"
).onclick = () => {

  penEnabled =
    true;

  tool =
    "eraser";

  drawing =
    false;

  updatePenButton();

};


/*
 * 全消去
 */

document.getElementById(
  "clear"
).onclick = async () => {

  const context =
    annotationCanvas
      .getContext("2d");


  context.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );


  context.globalCompositeOperation =
    "source-over";


  await saveAnnotation();

};


/*
 * 前ページ
 */

document.getElementById(
  "previous"
).onclick = async () => {

  if (
    currentPage <= 1
  ) {

    return;

  }


  await saveAnnotation();


  currentPage--;


  await render();

};


/*
 * 次ページ
 */

document.getElementById(
  "next"
).onclick = async () => {

  if (
    currentPage >=
    getPageCount()
  ) {

    return;

  }


  await saveAnnotation();


  currentPage++;


  await render();

};


/*
 * Ctrl + ホイール
 *
 * PCで自由に拡大縮小
 */

viewerStage.addEventListener(
  "wheel",
  event => {

    if (
      !event.ctrlKey
    ) {

      return;

    }


    event.preventDefault();


    const amount =
      event.deltaY > 0
        ? -0.1
        : 0.1;


    zoom =
      Math.max(
        0.5,
        Math.min(
          4,
          Number(
            (
              zoom +
              amount
            ).toFixed(2)
          )
        )
      );


    scheduleZoomRender();

  },
  {
    passive: false
  }
);


/*
 * ズーム再描画
 *
 * ホイール中に大量のPDF描画を
 * 発生させない
 */

function scheduleZoomRender() {

  if (
    zoomRenderTimer
  ) {

    clearTimeout(
      zoomRenderTimer
    );

  }


  zoomRenderTimer =
    setTimeout(
      async () => {

        zoomRenderTimer =
          null;


        await saveAnnotation();

        await render();

      },
      80
    );

}


/*
 * 2本指ピンチ開始
 */

viewerStage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length !== 2
    ) {

      return;

    }


    const first =
      event.touches[0];

    const second =
      event.touches[1];


    pinchStartDistance =
      Math.hypot(
        second.clientX -
          first.clientX,

        second.clientY -
          first.clientY
      );


    pinchStartZoom =
      zoom;

  },
  {
    passive: true
  }
);


/*
 * 2本指ピンチ中
 */

viewerStage.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length !== 2 ||
      pinchStartDistance === null
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


    const ratio =
      distance /
      pinchStartDistance;


    zoom =
      Math.max(
        0.5,
        Math.min(
          4,
          Number(
            (
              pinchStartZoom *
              ratio
            ).toFixed(2)
          )
        )
      );


    scheduleZoomRender();

  },
  {
    passive: false
  }
);


/*
 * ピンチ終了
 */

viewerStage.addEventListener(
  "touchend",
  event => {

    if (
      event.touches.length < 2
    ) {

      pinchStartDistance =
        null;

    }

  }
);


/*
 * ページ左右スワイプ
 *
 * ペンOFF時のみ
 */

viewerStage.addEventListener(
  "pointerdown",
  event => {

    if (
      penEnabled
    ) {

      return;

    }


    swipeStartX =
      event.clientX;

    swipeStartY =
      event.clientY;

  }
);


viewerStage.addEventListener(
  "pointerup",
  async event => {

    if (
      penEnabled ||
      swipeStartX === null ||
      swipeStartY === null
    ) {

      swipeStartX =
        null;

      swipeStartY =
        null;

      return;

    }


    const diffX =
      event.clientX -
      swipeStartX;


    const diffY =
      event.clientY -
      swipeStartY;


    swipeStartX =
      null;

    swipeStartY =
      null;


    if (
      Math.abs(diffX) < 70
    ) {

      return;

    }


    if (
      Math.abs(diffX) <
      Math.abs(diffY)
    ) {

      return;

    }


    if (
      diffX < 0
    ) {

      if (
        currentPage <
        getPageCount()
      ) {

        await saveAnnotation();

        currentPage++;

        await render();

      }

    }
    else {

      if (
        currentPage > 1
      ) {

        await saveAnnotation();

        currentPage--;

        await render();

      }

    }

  }
);


/*
 * 書き込み開始
 */

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


    const scaleX =
      annotationCanvas.width /
      rect.width;


    const scaleY =
      annotationCanvas.height /
      rect.height;


    lastX =
      (
        event.clientX -
        rect.left
      ) *
      scaleX;


    lastY =
      (
        event.clientY -
        rect.top
      ) *
      scaleY;

  }
);


/*
 * 書き込み中
 */

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


    const scaleX =
      annotationCanvas.width /
      rect.width;


    const scaleY =
      annotationCanvas.height /
      rect.height;


    const x =
      (
        event.clientX -
        rect.left
      ) *
      scaleX;


    const y =
      (
        event.clientY -
        rect.top
      ) *
      scaleY;


    const context =
      annotationCanvas
        .getContext("2d");


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
        "rgba(255,235,0,0.45)";

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


/*
 * 書き込み終了
 */

annotationCanvas.addEventListener(
  "pointerup",
  async event => {

    if (!drawing) {

      return;

    }


    drawing =
      false;


    try {

      annotationCanvas
        .releasePointerCapture(
          event.pointerId
        );

    }
    catch {}


    await saveAnnotation();

  }
);


/*
 * 書き込みキャンセル
 */

annotationCanvas.addEventListener(
  "pointercancel",
  () => {

    drawing =
      false;

  }
);


/*
 * 書き込み保存
 */

async function saveAnnotation() {

  if (
    !annotationCanvas.width ||
    !annotationCanvas.height
  ) {

    return;

  }


  const image =
    annotationCanvas
      .toDataURL(
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

          annotation_data: {
            image,

            width:
              annotationCanvas.width,

            height:
              annotationCanvas.height
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


/*
 * 書き込み読み込み
 */

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


  const context =
    annotationCanvas
      .getContext("2d");


  context.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );


  context.globalCompositeOperation =
    "source-over";


  if (
    error ||
    !data ||
    !data.annotation_data ||
    !data.annotation_data.image
  ) {

    return;

  }


  const image =
    new Image();


  image.onload = () => {

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


/*
 * 戻る
 */

document.getElementById(
  "close"
).onclick = async () => {

  await saveAnnotation();


  if (
    window.opener
  ) {

    window.close();

    return;

  }


  location.replace(
    "../"
  );

};


/*
 * キーボード操作
 */

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

      document.getElementById(
        "previous"
      ).click();

    }


    if (
      event.key ===
      "ArrowRight"
    ) {

      document.getElementById(
        "next"
      ).click();

    }


    if (
      event.key ===
      "Escape"
    ) {

      document.getElementById(
        "close"
      ).click();

    }

  }
);


/*
 * 起動
 */

async function start() {

  try {

    updatePenButton();

    await checkLicense();

    await loadBook();

    await render();

  }
  catch (error) {

    console.error(
      "VIEWER START ERROR:",
      error
    );


    alert(
      error.message ||
      "Viewerを起動できませんでした。"
    );


    location.replace(
      "../"
    );

  }

}


start();
