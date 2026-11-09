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
  throw new Error("Unauthorized");
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
    "viewerStage"
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

let rendering = false;

let pinchDistance = null;

let pinchZoom = 1;

let swipeX = null;

let swipeY = null;

let swipeTime = 0;

let renderTimer = null;


/*
 * 利用権
 */

async function checkLicense() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select("id")
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


/*
 * Book
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


/*
 * Storage URL
 */

async function signedUrl(
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


/*
 * PDF
 */

async function loadPdf() {

  const url =
    await signedUrl(
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


/*
 * 画像
 */

async function loadImages() {

  const {
    data,
    error
  } =
    await supabase
      .from("book_pages")
      .select(
        "page_number,file_path"
      )
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


/*
 * ページ数
 */

function pageCount() {

  if (
    book.file_type ===
    "pdf"
  ) {

    return pdf?.numPages || 0;
  }


  return pages.length;
}


/*
 * ページ番号
 */

function updatePage() {

  pageLabel.textContent =
    `${currentPage} / ${pageCount()}`;
}


/*
 * 書き込みCanvas
 */

function setupAnnotation(
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

async function renderPdf() {

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


    container.style.width =
      `${viewport.width}px`;

    container.style.height =
      `${viewport.height}px`;


    await page.render({
      canvasContext:
        pdfCanvas.getContext(
          "2d"
        ),

      viewport
    }).promise;


    pdfCanvas.style.display =
      "block";

    imagePage.style.display =
      "none";


    setupAnnotation(
      viewport.width,
      viewport.height
    );


    updatePage();


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

async function renderImage() {

  const page =
    pages[
      currentPage - 1
    ];


  if (!page) {
    return;
  }


  const url =
    await signedUrl(
      page.file_path
    );


  const image =
    new Image();


  await new Promise(
    (resolve, reject) => {

      image.onload =
        resolve;

      image.onerror =
        reject;

      image.src =
        url;
    }
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


  imagePage.src =
    url;

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


  setupAnnotation(
    width,
    height
  );


  updatePage();


  await loadAnnotation();
}


/*
 * 表示
 */

async function render() {

  if (
    book.file_type ===
    "pdf"
  ) {

    if (!pdf) {
      await loadPdf();
    }


    await renderPdf();

    return;
  }


  if (
    pages.length === 0
  ) {

    await loadImages();
  }


  await renderImage();
}


/*
 * ペン状態
 */

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


penButton.onclick = () => {

  penEnabled =
    !penEnabled;

  tool =
    penEnabled
      ? "pen"
      : null;

  drawing =
    false;

  updatePen();
};


/*
 * 蛍光ペン
 */

document.getElementById(
  "highlighter"
).onclick = () => {

  penEnabled = true;

  tool = "highlighter";

  updatePen();
};


/*
 * 消しゴム
 */

document.getElementById(
  "eraser"
).onclick = () => {

  penEnabled = true;

  tool = "eraser";

  updatePen();
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


  await saveAnnotation();
};


/*
 * 前へ
 */

async function previous() {

  if (
    currentPage <= 1
  ) {

    return;
  }


  await saveAnnotation();


  currentPage--;


  await render();
}


/*
 * 次へ
 */

async function next() {

  if (
    currentPage >=
    pageCount()
  ) {

    return;
  }


  await saveAnnotation();


  currentPage++;


  await render();
}


document.getElementById(
  "previous"
).onclick =
  previous;


document.getElementById(
  "next"
).onclick =
  next;


/*
 * PC自由ズーム
 */

stage.addEventListener(
  "wheel",
  event => {

    if (
      !event.ctrlKey
    ) {

      return;
    }


    event.preventDefault();


    zoom +=
      event.deltaY > 0
        ? -.1
        : .1;


    zoom =
      Math.max(
        .5,
        Math.min(
          4,
          Number(
            zoom.toFixed(2)
          )
        )
      );


    clearTimeout(
      renderTimer
    );


    renderTimer =
      setTimeout(
        () => render(),
        80
      );

  },
  {
    passive: false
  }
);


/*
 * タッチ開始
 */

stage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length === 2
    ) {

      const a =
        event.touches[0];

      const b =
        event.touches[1];


      pinchDistance =
        Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY
        );


      pinchZoom =
        zoom;

      return;
    }


    if (
      penEnabled
    ) {

      return;
    }


    const touch =
      event.touches[0];


    swipeX =
      touch.clientX;

    swipeY =
      touch.clientY;

    swipeTime =
      Date.now();

  },
  {
    passive: true
  }
);


/*
 * ピンチ
 */

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


    const a =
      event.touches[0];

    const b =
      event.touches[1];


    const distance =
      Math.hypot(
        b.clientX - a.clientX,
        b.clientY - a.clientY
      );


    zoom =
      Math.max(
        .5,
        Math.min(
          4,
          Number(
            (
              pinchZoom *
              distance /
              pinchDistance
            ).toFixed(2)
          )
        )
      );


    clearTimeout(
      renderTimer
    );


    renderTimer =
      setTimeout(
        () => render(),
        80
      );

  },
  {
    passive: false
  }
);


/*
 * 横スワイプ
 */

stage.addEventListener(
  "touchend",
  async event => {

    if (
      event.touches.length > 0
    ) {

      return;
    }


    if (
      penEnabled ||
      swipeX === null
    ) {

      swipeX =
        null;

      swipeY =
        null;

      return;
    }


    const touch =
      event.changedTouches[0];


    const dx =
      touch.clientX -
      swipeX;


    const dy =
      touch.clientY -
      swipeY;


    const elapsed =
      Date.now() -
      swipeTime;


    swipeX =
      null;

    swipeY =
      null;


    if (
      elapsed > 700 ||
      Math.abs(dx) < 70 ||
      Math.abs(dx) <= Math.abs(dy)
    ) {

      return;
    }


    if (
      dx < 0
    ) {

      await next();

    }
    else {

      await previous();

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
      tool === "highlighter"
    ) {

      context.lineWidth =
        18;

      context.strokeStyle =
        "rgba(255,235,0,.45)";

      context.globalCompositeOperation =
        "source-over";

    }
    else if (
      tool === "eraser"
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
 * 保存
 */

async function saveAnnotation() {

  if (
    !annotationCanvas.width
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


/*
 * 保存済み書き込み
 */

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
      .getContext("2d");


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


/*
 * Viewerを閉じる
 *
 * Book一覧から別タブで開かれた場合は
 * このタブを閉じて元のMy Booksへ戻る。
 */

document.getElementById(
  "close"
).onclick = async () => {

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


/*
 * キーボード
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

      previous();

    }


    if (
      event.key ===
      "ArrowRight"
    ) {

      next();

    }

  }
);


/*
 * 起動
 */

async function start() {

  try {

    updatePen();

    await checkLicense();

    await loadBook();

    await render();

  }
  catch (error) {

    console.error(
      "VIEWER ERROR:",
      error
    );


    alert(
      error.message ||
      "Viewerを起動できませんでした。"
    );


    location.replace(
      "../books/"
    );

  }
}


start();
