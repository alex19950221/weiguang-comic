import { useId } from 'preact/hooks';
import type { DemoBook, Motif } from '@/app/demo';

const palette: Record<Motif, [string, string, string]> = {
  mountain: ['#e9e7d5', '#899d85', '#364e43'],
  town: ['#d6ddd7', '#7f9895', '#465d5b'],
  space: ['#253c4d', '#526c7b', '#172a3c'],
  daily: ['#eddbcc', '#c59478', '#8a6655'],
  sea: ['#e4e1ce', '#8bb4b4', '#416b72'],
  forest: ['#dde0c9', '#8e9c72', '#435a40'],
};

function Tree({
  x,
  y,
  scale = 1,
  color = '#354e43',
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0v130" stroke="#514b3c" stroke-width="7" />
      <path d="m0-50-45 95h90Zm0 35-58 110H58Zm0 40-68 110H68Z" fill={color} />
    </g>
  );
}
function Walker({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="m-7 29-8 38m24-38 11 36" stroke="#39473e" stroke-width="8" />
      <path d="M-12-5h25l7 37h-39Z" fill="#c26445" />
      <circle cy="-17" r="10" fill="#e8c2a0" />
      <path d="M-11-19a11 11 0 0 1 22 0Z" fill="#48564b" />
      <rect x="-23" y="0" width="15" height="27" rx="6" fill="#dacdb0" />
      <path d="m17 6 12 18" stroke="#d8b18c" stroke-width="6" />
    </g>
  );
}

/** 原生 SVG 插画：随画册与页码变化，无外部素材或远端请求。 */
export function DemoScene({
  motif,
  variation = 0,
}: {
  motif: Motif;
  variation?: number;
}) {
  const uid = useId().replaceAll(':', '');
  const [sky, mid, dark] = palette[motif];
  const shift = variation % 4;
  return (
    <svg
      viewBox="0 0 600 840"
      class="demo-scene"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}sky`} x2="0" y2="1">
          <stop stop-color={sky} />
          <stop
            offset="1"
            stop-color={motif === 'space' ? '#6e7e80' : '#f3e9ce'}
          />
        </linearGradient>
        <pattern
          id={`${uid}paper`}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r=".7" fill="#fff" opacity=".32" />
          <path d="M7 8h3" stroke="#333" stroke-opacity=".04" />
        </pattern>
      </defs>
      <rect width="600" height="840" fill={`url(#${uid}sky)`} />
      {motif === 'mountain' && (
        <>
          <circle cx={400 - shift * 35} cy="216" r="67" fill="#c8734d" />
          <path
            d="M-70 480 170 210l172 245 140-172 180 242V850H-70Z"
            fill="#acb49b"
          />
          <path d="m104 285 66-75 51 73-39-19-21 21-24-7Z" fill="#efecdc" />
          <path
            d="M-60 610 138 363l138 207 133-134 210 210v220H-60Z"
            fill={mid}
          />
          <path
            d="M-40 690c155-208 293 50 417-29s176-76 265-32v211H-40Z"
            fill="#5e7867"
          />
          <path
            d="M344 557c-155 109 22 130-56 188s-45 79-18 110h127c-61-88-139-74-70-134s-73-104 17-164Z"
            fill="#c9d3c1"
          />
          <path
            d="M-70 765c118-57 208-36 330-4s204-36 384-40v125H-70Z"
            fill={dark}
          />
          <path
            d="M70 832c45-55 75-73 149-72"
            stroke="#e2cfa4"
            stroke-width="28"
            fill="none"
          />
          <Tree x={70} y={589} scale={0.8} />
          <Tree x={522} y={576} scale={1.2} />
          <Tree x={563} y={656} scale={0.8} />
          <Walker x={183 + shift * 13} y={740} scale={0.47} />
          <path
            d="M65 173h110m-38-18h88M355 106h85"
            stroke="#fff"
            stroke-width="6"
            opacity=".35"
          />
        </>
      )}
      {motif === 'sea' && (
        <>
          <circle cx="422" cy={235 - shift * 14} r="68" fill="#db9a6e" />
          <path d="M0 383c131-21 347-17 600 2v455H0Z" fill={mid} />
          {[430, 477, 535, 608, 694, 767].map((y, i) => (
            <path
              key={y}
              d={`M${i % 2 ? -30 : 70} ${y}q130-20 260 0t320 0`}
              fill="none"
              stroke="#d5e2d3"
              stroke-width={i + 2}
              opacity=".7"
            />
          ))}
          <path
            d="M0 533c169-35 276 30 271 132-4 102 133 82 186 175H0Z"
            fill="#bec6aa"
          />
          <path
            d="M0 640c131-92 224-12 164 55-42 48 115 62 158 145H0"
            fill="#698471"
          />
          <path
            d="M25 840c-10-89 166-129 124-192"
            stroke="#ece0bc"
            stroke-width="28"
            fill="none"
          />
          <path d="M391 474h59v111h-59Z" fill="#eee6cf" />
          <path d="m381 474 40-30 39 30Z" fill="#ba6c4b" />
          <path d="M421 385v59m-12-31h24" stroke="#4b6260" stroke-width="5" />
          <Walker x={124} y={710} scale={0.6} />
          <path
            d="m174 238 13-6 13 6m40 21 11-5 12 5"
            fill="none"
            stroke={dark}
            stroke-width="3"
          />
        </>
      )}
      {motif === 'town' && (
        <>
          <path d="M0 292h600v548H0Z" fill="#a3b4ab" />
          <path d="M65 399h200v384H65Z" fill="#d5d1b6" />
          <path d="m40 399 126-93 126 93Z" fill="#6b7770" />
          <path d="M340 340h210v441H340Z" fill="#ece2c8" />
          <path d="m321 340 123-66 128 66Z" fill="#a36f5e" />
          <path d="M255 490h101v291H255Z" fill="#798a7e" />
          {[99, 181, 373, 459].map((x, i) => (
            <g key={x}>
              {[437, 529, 628].map((y) => (
                <g key={y}>
                  <rect
                    x={x}
                    y={y - (i > 1 ? 62 : 0)}
                    width="42"
                    height="59"
                    fill="#667c75"
                  />
                  <path
                    d={`M${x + 21} ${y - (i > 1 ? 62 : 0)}v59m-21-30h42`}
                    stroke="#d4d6b7"
                    stroke-width="4"
                  />
                </g>
              ))}
            </g>
          ))}
          <path d="M0 796h600v44H0Z" fill="#516c62" />
          <path d="M294 638 220 840h226L327 638" fill="#b8bba2" />
          <path
            d="m240 780 182 0m-166-31h149m-133-27h119"
            stroke="#6e8376"
            stroke-width="7"
          />
          <path
            d="M-10 291c240 66 401 63 641-13"
            stroke="#506760"
            stroke-width="3"
            fill="none"
          />
          {[90, 215, 413, 530].map((x) => (
            <path
              key={x}
              d={`m${x} 98-28 84m48 28-29 84m70-29-26 76`}
              stroke="#fff"
              opacity=".3"
              stroke-width="3"
            />
          ))}
          <Walker x={298 + shift * 8} y={733} scale={0.5} />
          <Tree x={28} y={662} scale={0.7} />
        </>
      )}
      {motif === 'space' && (
        <>
          {Array.from({ length: 38 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 107 + 47) % 590}
              cy={(i * 137 + 33) % 670}
              r={i % 4 === 0 ? 2.8 : 1.3}
              fill="#eee5c8"
              opacity={0.4 + (i % 4) * 0.15}
            />
          ))}
          <circle cx={398 - shift * 22} cy="266" r="107" fill="#d5a071" />
          <path
            d="M256 315c-72 79 241-16 284-86"
            stroke="#8fadb0"
            stroke-width="19"
            fill="none"
          />
          <path d="M-30 690c207-175 436-120 667 69v81H-30" fill="#8c9e9a" />
          <path d="M-40 780c167-70 462-90 690 35v35H-40" fill="#536f71" />
          <ellipse cx="130" cy="711" rx="47" ry="16" fill="#6d8787" />
          <ellipse cx="470" cy="772" rx="63" ry="19" fill="#405c63" />
          <g transform={`translate(${280 + shift * 18} 553)`}>
            <path d="M-22 22h65v115h-65Z" fill="#c37b53" />
            <path d="M-28 29v-44a38 38 0 0 1 76 0v44Z" fill="#d9a36d" />
            <rect x="-13" y="-12" width="44" height="7" rx="2" fill="#684e47" />
            <path d="M10 137v70" stroke="#364f59" stroke-width="9" />
            <text
              x="10"
              y="80"
              text-anchor="middle"
              fill="#f6e4be"
              font-size="27"
            >
              〒
            </text>
          </g>
          <path d="m131 375 38-74 36 74-35 30Z" fill="#c8d9ce" />
          <path d="m152 392 17 45 17-45" fill="#d19a69" />
          <circle cx="169" cy="355" r="11" fill="#4f6e77" />
        </>
      )}
      {motif === 'forest' && (
        <>
          <circle cx="420" cy="237" r="76" fill="#e3c790" />
          <path d="M0 489c181-153 390-91 600 2v349H0Z" fill="#a6b38c" />
          {[20, 110, 515, 590].map((x, i) => (
            <Tree
              key={x}
              x={x}
              y={287 + (i % 2) * 85}
              scale={1.6 - (i % 2) * 0.3}
              color={i % 2 ? '#71896a' : '#8a9e7b'}
            />
          ))}
          <path d="M141 553h318v222H141Z" fill="#ded7b6" />
          <path d="m106 553 194-137 197 137Z" fill="#69775b" />
          <path d="M271 626h64v149h-64Z" fill="#705f45" />
          <rect x="165" y="602" width="76" height="75" fill="#d4b66c" />
          <rect x="361" y="602" width="76" height="75" fill="#d4b66c" />
          <path
            d="M203 602v75m-38-38h76m158-37v75m-38-38h76"
            stroke="#7a7c58"
            stroke-width="5"
          />
          <rect x="249" y="538" width="108" height="48" rx="4" fill="#e9ddbb" />
          <text
            x="303"
            y="569"
            text-anchor="middle"
            font-size="24"
            fill="#5c6547"
          >
            食 堂
          </text>
          <path d="M397 483v-61h33v87" fill="#9b8b68" />
          <path
            d="M410 417c-29-31 31-36 1-69"
            stroke="#f1edda"
            stroke-width="15"
            fill="none"
            opacity=".6"
          />
          <path d="M0 804c163-54 428-42 600-10v46H0Z" fill="#657a52" />
          <path d="m300 774-73 66h163l-80-66" fill="#c8bf96" />
          <Walker x={240 + shift * 14} y={777} scale={0.45} />
        </>
      )}
      {motif === 'daily' && (
        <>
          <rect
            x="95"
            y="225"
            width="407"
            height="340"
            rx="160"
            fill="#e8e1ca"
          />
          <path
            d="M297 229v330M101 398h395"
            stroke="#ba9c80"
            stroke-width="13"
          />
          <path d="M111 462c126-68 239-38 381-52v140H111Z" fill="#a1b19b" />
          <circle cx="401" cy="314" r="43" fill="#d99b73" />
          <path d="M0 688h600v152H0Z" fill="#b78f72" />
          <path d="M0 688h600" stroke="#916e58" stroke-width="11" />
          <path d="M181 606h145v95H181Z" fill="#f0e6ce" />
          <path
            d="M326 621c67-15 68 77 0 61"
            stroke="#f0e6ce"
            stroke-width="17"
            fill="none"
          />
          <path
            d="M223 582c-32-32 33-52 0-82m55 76c-23-30 26-43 3-69"
            stroke="#fff"
            stroke-width="9"
            opacity=".65"
            fill="none"
          />
          <path d="M407 616h77l-10 84h-57Z" fill="#8d7958" />
          <path d="M446 618V445" stroke="#6b805a" stroke-width="8" />
          <path
            d="M446 536c-94-1-99-84-99-84 84 7 104 43 99 84Zm0-35c83-2 100-76 100-76-81 0-104 46-100 76Z"
            fill="#82986b"
          />
          <path d="M67 746h247v31H67Z" fill="#7a8d77" />
          <path d="M85 714h202v31H85Z" fill="#dbbb89" />
        </>
      )}
      <rect width="600" height="840" fill={`url(#${uid}paper)`} />
    </svg>
  );
}

export function DemoCover({
  book,
  small = false,
}: {
  book: DemoBook;
  small?: boolean;
}) {
  const variation = (book.volume ?? 1) - 1;
  const shape = book.images ? 'portrait' : book.cover;
  return (
    <div
      class={`demo-cover motif-${book.motif} cover-${shape} ${small ? 'is-small' : ''}`}
    >
      {book.images ? (
        <img src={book.images[0]} alt="" />
      ) : shape === 'none' ? (
        // 第一张不是图片或无法解码时，用格式和书名占位。
        <span class="cover-missing">
          <b>{book.format}</b>
          <span>{book.title}</span>
        </span>
      ) : shape === 'designed' || shape === 'portrait' ? (
        <DemoScene motif={book.motif} variation={variation} />
      ) : (
        // 横版和长条封面完整显示，不裁切。
        <span class="cover-letterbox">
          <DemoScene motif={book.motif} variation={variation} />
        </span>
      )}
      {shape === 'designed' && (
        <>
          <span class="cover-topline">微 光 原 创 视 觉 样 张</span>
          <div class="cover-lettering">
            <span class="cover-title">{book.title}</span>
            <span class="cover-subtitle">{book.subtitle}</span>
          </div>
          <span class="cover-number">
            {String(book.volume ?? 1).padStart(2, '0')}
            <i>VOLUME</i>
          </span>
          <span class="cover-imprint">LUMI COMIC · VISUAL STUDY</span>
        </>
      )}
    </div>
  );
}

const narrative = [
  '那天，我在一座小小的车站下了车。',
  '风从山的那边来，带着一点海的味道。',
  '地图上的路，和记忆中的有些不同。',
  '走慢一点，也许会发现新的风景。',
  '午后的光，悄悄落在信封的一角。',
  '有些答案，需要绕一点远路。',
  '原来熟悉的地方，也藏着未见过的故事。',
  '天色还早，我们沿着小路继续走。',
  '每一次停留，都有它自己的意义。',
  '我把今天的风景，收进了口袋。',
  '远处有人招手，像是等了很久。',
  '故事暂时停在这里。明天，再出发。',
];

export function DemoComicPage({
  book,
  page,
}: {
  book: DemoBook;
  page: number;
}) {
  const id = useId().replaceAll(':', '');
  if (book.images)
    return (
      <img
        class="local-comic-page"
        src={book.images[page]}
        alt={`${book.title}，第 ${page + 1} 页`}
      />
    );
  return (
    <svg
      class="comic-vector-page"
      viewBox="0 0 600 840"
      role="img"
      aria-label={`${book.title}第 ${page + 1} 页：${narrative[page % narrative.length]}`}
    >
      <defs>
        <clipPath id={`${id}a`}>
          <rect x="22" y="22" width="556" height="346" />
        </clipPath>
        <clipPath id={`${id}b`}>
          <rect x="22" y="385" width="270" height="246" />
        </clipPath>
        <clipPath id={`${id}c`}>
          <rect x="309" y="385" width="269" height="246" />
        </clipPath>
        <clipPath id={`${id}d`}>
          <rect x="22" y="648" width="556" height="163" />
        </clipPath>
      </defs>
      <rect width="600" height="840" fill="#f5efdf" />
      <g clip-path={`url(#${id}a)`}>
        <svg x="22" y="-150" width="556" height="780">
          <DemoScene motif={book.motif} variation={page} />
        </svg>
      </g>
      <g clip-path={`url(#${id}b)`}>
        <svg x="-75" y="168" width="430" height="600">
          <DemoScene motif={book.motif} variation={page + 1} />
        </svg>
      </g>
      <g clip-path={`url(#${id}c)`}>
        <svg x="242" y="111" width="440" height="616">
          <DemoScene motif={book.motif} variation={page + 2} />
        </svg>
      </g>
      <g clip-path={`url(#${id}d)`}>
        <svg x="22" y="312" width="556" height="778">
          <DemoScene motif={book.motif} variation={page + 3} />
        </svg>
      </g>
      <g fill="none" stroke="#5b5c4e" stroke-width="1.5">
        <rect x="22" y="22" width="556" height="346" />
        <rect x="22" y="385" width="270" height="246" />
        <rect x="309" y="385" width="269" height="246" />
        <rect x="22" y="648" width="556" height="163" />
      </g>
      <rect
        x="40"
        y="42"
        width="338"
        height="47"
        fill="#f9f4e6"
        stroke="#726e5b"
        stroke-width="1"
      />
      <text x="55" y="72" font-size="16" fill="#484b3c" font-family="serif">
        {narrative[page % narrative.length]}
      </text>
      <ellipse
        cx="425"
        cy="442"
        rx="70"
        ry="39"
        fill="#fcf8ed"
        stroke="#656757"
        stroke-width="1.5"
      />
      <path
        d="m402 476 1 24 22-23"
        fill="#fcf8ed"
        stroke="#656757"
        stroke-width="1.5"
      />
      <text
        x="425"
        y="447"
        text-anchor="middle"
        font-family="serif"
        font-size="16"
        fill="#454d40"
      >
        {page % 2 ? '嗯。我们走吧。' : '你也在等风吗？'}
      </text>
      <rect x="333" y="755" width="222" height="35" fill="#f8f1df" />
      <text x="348" y="779" font-size="15" fill="#535443" font-family="serif">
        {page === 11 ? '这一程，未完待续。' : '于是，又多了一段小小的旅程。'}
      </text>
      <text x="300" y="831" text-anchor="middle" font-size="12" fill="#8a8979">
        — {String(page + 1).padStart(2, '0')} —
      </text>
    </svg>
  );
}
