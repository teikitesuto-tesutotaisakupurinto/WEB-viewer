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
    "../"
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


let book;

let pdf = null;

let pages = [];

let currentPage = 1;

let zoom = 1;

let penEnabled = false;

let tool = null;

let drawing = false;

let lastX = 0;

let lastY = 0;

let pinchDistance = null;

let pinchZoom = 1;

let swipeX = null;

let swipeY = null;

let swipeTime = 0;

let renderTimer = null;

let rendering = false;


/*
 * 権限
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
 * 署名URL
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


  await render();
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
      .select(`
        page_number,
        file_path
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


/*
 * ページ数
 */

function countPages() {

  if (
    book.file_type ===
    "pdf"
  ) {

    return pdf?.numPages || 0;
  }

  return pages.length;
}


/*
 * ページ表示
 */

function updatePage() {

  pageLabel.textContent =
    `${currentPage} / ${countPages()}`;
}


/*
 * Annotation
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
 * render
 */

async function render() {

  if (
    book.file_type ===
    "pdf"
  ) {

    if (!pdf) {
      await loadPdf();
      return;
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

  penEnabled =
    true;

  tool =
    "highlighter";

  updatePen();
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

  updatePen();
};


/*
 * 全消去
 */

document.getElementById(
  "clear"
).onclick = async () => {

  const ctx =
    annotationCanvas
      .getContext("2d");

  ctx.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );

  await saveAnnotation();
};


/*
 * 前
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
 * 次
 */

async function next() {

  if (
    currentPage >=
    countPages()
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
 * PCズーム
 */

stage.addEventListener(
  "wheel",
  event => {

    if (!event.ctrlKey) {
      return;
    }


    event.preventDefault();


    zoom +=
      event.deltaY > 0
        ? -0.1
        : 0.1;


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


    if (penEnabled) {
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


    if (dx < 0) {
      await next();
    }
    else {
      await previous();
    }

  }
);


/*
 * 書き込み
 */

annotationCanvas.addEventListener(
  "pointerdown",
  event => {

    if (!penEnabled) {
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


    const ctx =
      annotationCanvas
        .getContext("2d");


    ctx.beginPath();

    ctx.moveTo(
      lastX,
      lastY
    );

    ctx.lineTo(
      x,
      y
    );

    ctx.lineCap =
      "round";


    if (
      tool === "highlighter"
    ) {

      ctx.lineWidth =
        18;

      ctx.strokeStyle =
        "rgba(255,235,0,.45)";

      ctx.globalCompositeOperation =
        "source-over";

    }
    else if (
      tool === "eraser"
    ) {

      ctx.lineWidth =
        28;

      ctx.globalCompositeOperation =
        "destination-out";

    }
    else {

      ctx.lineWidth =
        3;

      ctx.strokeStyle =
        "#111";

      ctx.globalCompositeOperation =
        "source-over";

    }


    ctx.stroke();


    lastX =
      x;

    lastY =
      y;

  }
);


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
    console.error(error);
  }
}


/*
 * 読み込み
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


  const ctx =
    annotationCanvas
      .getContext("2d");


  ctx.clearRect(
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

      ctx.drawImage(
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


  if (window.opener) {

    window.close();

    return;
  }


  location.replace(
    "../"
  );
};


/*
 * キーボード
 */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "ArrowLeft"
    ) {
      previous();
    }

    if (
      event.key === "ArrowRight"
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
