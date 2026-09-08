import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Orbit,
  Layers3,
  Moon,
  RotateCcw,
  Rotate3D,
  Plus,
  Minus,
  ArrowUp,
  ChevronRight,
  ArrowLeft,
  Info,
  FlipHorizontal2,
  Clock3,
  Check,
} from 'lucide-react';
import { createWatch } from './watch';
import { PARTS, type PartKey, type Snapshot } from './mechanism';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const initial: Snapshot = {
  reserve: 115200,
  time: '10:08:36',
  running: true,
  amplitude: 270,
  setting: false,
  crownTurns: 16,
  speed: 1,
};
export default function Home() {
  const mount = useRef<HTMLDivElement>(null),
    api = useRef<ReturnType<typeof createWatch> | null>(null),
    dragY = useRef<number | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [exploded, setExploded] = useState(false),
    [night, setNight] = useState(false),
    [auto, setAuto] = useState(false),
    [back, setBack] = useState(false),
    [selected, setSelected] = useState<PartKey | null>(null),
    [hover, setHover] = useState<{ key: PartKey; x: number; y: number } | null>(
      null,
    ),
    [snapshot, setSnapshot] = useState(initial),
    [winding, setWinding] = useState(false),
    [notice, setNotice] = useState('初始已预上链 32 小时'),
    [showInfo, setShowInfo] = useState(false),
    [timeInput, setTimeInput] = useState('10:08'),
    [labels, setLabels] = useState(true),
    [explosion, setExplosion] = useState(100),
    [speed, setSpeed] = useState('1');
  const labelsRef = useRef(true);
  labelsRef.current = labels;
  useEffect(() => {
    if (!mount.current) return;
    try {
      api.current = createWatch(mount.current, {
        onSnapshot: setSnapshot,
        onSelect: setSelected,
        onHover: (v) => setHover(labelsRef.current ? v : null),
        onWind: (full) =>
          setNotice(
            full ? '已满链 · 手动发条限位' : '上链中 · 棘爪防止发条回转',
          ),
        onError: setError,
      });
      setReady(true);
    } catch (e) {
      setError('当前设备无法初始化 WebGL 3D。请启用浏览器硬件加速后刷新页面。');
      console.error(e);
    }
    return () => {
      api.current?.dispose();
      api.current = null;
    };
  }, []);
  function selectPart(key: PartKey | null) {
    api.current?.select(key);
    setSelected(key);
  }
  function windOne() {
    api.current?.wind(1);
  }
  function padDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (snapshot.setting) return;
    dragY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    setWinding(true);
  }
  function padMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragY.current === null) return;
    const turns = (dragY.current - e.clientY) / 145;
    dragY.current = e.clientY;
    if (turns > 0) api.current?.wind(turns);
  }
  function padUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragY.current = null;
    setWinding(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function toggleSetting() {
    const next = !snapshot.setting;
    api.current?.setting(next);
    setTimeInput(snapshot.time.slice(0, 5));
    setNotice(next ? '表冠已拉出 · 停秒调时' : '表冠已推回 · 继续走时');
  }
  function applyTime() {
    const match = /^(\d{2}):(\d{2})$/.exec(timeInput);
    if (!match || +match[1] > 23 || +match[2] > 59) return;
    api.current?.movement.setTime(+match[1], +match[2], 0);
    api.current?.setting(false);
    setNotice('时间已设定 · 表冠已推回');
  }
  function resetView() {
    api.current?.reset();
    api.current?.explode(false);
    api.current?.night(false);
    api.current?.auto(false);
    setExploded(false);
    setNight(false);
    setAuto(false);
    setBack(false);
    setExplosion(100);
    selectPart(null);
  }
  const part = selected ? PARTS[selected] : null;
  const partKeys: PartKey[] = [
    'barrel',
    'train',
    'balance',
    'escapement',
    'bridges',
    'hands',
  ];
  return (
    <div className="site dark">
      <header className="header">
        <div className="brand">
          <span className="brand-symbol">◈</span>NOCTURNE
        </div>
        <small>THE ART OF MECHANICAL TIME</small>
        <div className="top-status">
          <i
            className="status-dot"
            style={{ opacity: snapshot.running ? 1 : 0.25 }}
          />
          {snapshot.setting
            ? '停秒调时'
            : snapshot.running
              ? '机芯运行中'
              : '等待上链'}
          <span className="header-ref"> / N° 01</span>
        </div>
      </header>
      <main className="main">
        <section className="intro">
          <div className="eyebrow">ATELIER / COLLECTION 01</div>
          <h1>
            Time,
            <br />
            revealed.<span>时间的内在之美</span>
          </h1>
          <p className="intro-copy">
            让时间，显露本真。
            <br />
            于方寸之间，探索精密机械的
            <br />
            秩序、力量与不息的律动。
          </p>
          <div className="fine-rule" />
          <p className="serial">
            SQUELETTE MANUEL
            <br />
            手动上链 · 开放机芯研究
          </p>
          <div className="intro-specs">
            <div>
              <strong>
                42 <span>mm</span>
              </strong>
              <small>表壳直径</small>
            </div>
            <div>
              <strong>
                3 <span>Hz</span>
              </strong>
              <small>摆轮频率</small>
            </div>
          </div>
          <button className="design-link" onClick={() => setShowInfo(true)}>
            <Info size={14} />
            机芯设计说明 <ChevronRight size={13} />
          </button>
        </section>
        <div className="stage" ref={mount}>
          {!ready && !error && <div className="loading">正在装配精密机芯…</div>}
          {error && (
            <div className="loading">
              <div className="error">
                {error}
                <br />
                <button onClick={() => location.reload()} className="wind-btn">
                  重新加载
                </button>
              </div>
            </div>
          )}
          {hover && labels && !winding && (
            <div
              className="hover-label"
              style={{
                left: Math.min(
                  hover.x + 16,
                  (mount.current?.clientWidth || 500) - 185,
                ),
                top: Math.max(12, hover.y - 42),
              }}
            >
              <span className="label-dot" />
              {PARTS[hover.key].title}
            </div>
          )}
          <div className="measure-tag">
            {exploded
              ? 'ANATOMY / N.01'
              : night
                ? 'AFTER DARK'
                : 'SQUELETTE / N.01'}
          </div>
          <div className="zoom-controls">
            <button
              aria-label="放大腕表"
              onClick={() => api.current?.zoom(0.87)}
            >
              <Plus size={16} />
            </button>
            <button
              aria-label="缩小腕表"
              onClick={() => api.current?.zoom(1.15)}
            >
              <Minus size={16} />
            </button>
          </div>
          <div className="stage-note">
            <Rotate3D size={15} />
            {exploded
              ? '分层探索 · 拖动旋转 · 点击零件'
              : '拖动旋转 · 滚轮缩放 · 点击探索'}
          </div>
        </div>
        <aside className="panel" aria-label="机芯信息与交互控制">
          <div className="panel-main">
            <div className="panel-kicker">
              {part ? part.en : 'THE HEART WITHIN'}
            </div>
            <div className="selected-heading">
              <h2>{part ? part.title : 'Calibre N.01'}</h2>
              {part && (
                <button
                  aria-label="返回机芯总览"
                  title="返回机芯总览"
                  className="info-back"
                  onClick={() => selectPart(null)}
                >
                  <ArrowLeft size={17} />
                </button>
              )}
            </div>
            <p className={part ? 'panel-description' : 'calibre-desc'}>
              {part ? (
                part.description
              ) : (
                <>
                  镂空手动上链机芯
                  <br />
                  每一次律动，都清晰可见。
                </>
              )}
            </p>
            {part ? (
              <div className="part-specs">
                {part.specs.map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="detail-row">
                  <span>振频</span>
                  <b>21,600 次 / 小时</b>
                </div>
                <div className="detail-row">
                  <span>擒纵机构</span>
                  <b>瑞士杠杆式</b>
                </div>
              </>
            )}
            <div className="section-line" />
            <div className="parts-list">
              {partKeys.map((key, i) => (
                <button
                  key={key}
                  className={
                    'part-select ' + (selected === key ? 'selected' : '')
                  }
                  onClick={() => selectPart(selected === key ? null : key)}
                  aria-pressed={selected === key}
                >
                  <span>
                    <span className="num">0{i + 1}</span>
                    {PARTS[key].title
                      .replace('与主发条', '')
                      .replace('传动齿轮系', '传动轮系')
                      .replace('镂空夹板与宝石轴承', '夹板与宝石轴承')
                      .replace('指针与拨针轮系', '指针与拨针轮系')}
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="panel-controls">
            <div className="section-line desktop-rule" />
            <div className="progress-label">
              <span className="panel-kicker">POWER RESERVE</span>
              <span className="reserve-status">
                {snapshot.reserve >= 172799
                  ? 'FULL'
                  : snapshot.reserve > 0
                    ? 'WOUND'
                    : 'EMPTY'}
              </span>
            </div>
            <div className="power-readout">
              <strong>{(snapshot.reserve / 3600).toFixed(1)}</strong>
              <span>/ 48 H</span>
            </div>
            <div
              className="power-track"
              role="meter"
              aria-label="动力储存（小时）"
              aria-valuemin={0}
              aria-valuemax={48}
              aria-valuenow={Math.round(snapshot.reserve / 360) / 10}
            >
              <span
                style={{ width: `${(snapshot.reserve / 172800) * 100}%` }}
              />
            </div>
            <div
              className={'winding-pad ' + (winding ? 'winding' : '')}
              role="button"
              tabIndex={0}
              aria-label="上链区域，向上拖动，或按回车上链一圈"
              onPointerDown={padDown}
              onPointerMove={padMove}
              onPointerUp={padUp}
              onPointerCancel={padUp}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  windOne();
                }
              }}
            >
              <div className="pad-top">
                <span>{snapshot.setting ? '表冠已拉出' : '手动上链'}</span>
                <ArrowUp size={15} />
              </div>
              <p>
                {snapshot.setting
                  ? '推回表冠后可继续上链'
                  : '向上拖动此处，或直接拖动表冠'}
              </p>
              <div className="winding-teeth" />
            </div>
            <div className="wind-actions">
              <button
                onClick={windOne}
                disabled={
                  !ready || snapshot.setting || snapshot.reserve >= 172800
                }
              >
                <RotateCcw size={13} />
                上链一圈
              </button>
              <button onClick={toggleSetting} disabled={!ready}>
                <Clock3 size={13} />
                {snapshot.setting ? '推回表冠' : '拉出调时'}
              </button>
            </div>
            {snapshot.setting && (
              <div className="setting-row">
                <input
                  type="time"
                  aria-label="设定小时和分钟"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                />
                <button onClick={applyTime} aria-label="应用时间">
                  <Check size={16} />
                </button>
              </div>
            )}
            <div className="status-message" aria-live="polite">
              {notice}
            </div>
            <div className="time-line">
              <span>机芯时间</span>
              <output className="time-readout">{snapshot.time}</output>
            </div>
          </div>
        </aside>
        <div className="toolbar" aria-label="展示选项">
          <button
            title="自由探索 / 自动旋转"
            aria-pressed={auto}
            className={'tool-button ' + (auto ? 'active' : '')}
            onClick={() => {
              api.current?.auto(!auto);
              setAuto(!auto);
            }}
          >
            <Orbit size={16} />
            <span className="control-name">
              {auto ? '自动环绕' : '自由探索'}
            </span>
          </button>
          <button
            title="爆炸视图"
            aria-pressed={exploded}
            className={'tool-button ' + (exploded ? 'active' : '')}
            onClick={() => {
              api.current?.explode(!exploded);
              setAuto(false);
              setExploded(!exploded);
              setBack(false);
              setExplosion(100);
            }}
          >
            <Layers3 size={16} />
            <span className="control-name">爆炸视图</span>
          </button>
          <div className="tool-divider" />
          <button
            title="夜光模式"
            aria-pressed={night}
            className={'tool-button ' + (night ? 'active' : '')}
            onClick={() => {
              api.current?.night(!night);
              setNight(!night);
            }}
          >
            <Moon size={16} />
            <span className="control-name">夜光</span>
          </button>
          <button
            title={back ? '正面视角' : '背透视角'}
            aria-label={back ? '正面视角' : '背透视角'}
            aria-pressed={back}
            className={'tool-button ' + (back ? 'active' : '')}
            onClick={() => {
              if (back) api.current?.reset();
              else api.current?.back();
              setBack(!back);
            }}
          >
            <FlipHorizontal2 size={16} />
          </button>
          <button
            title="重置视角"
            aria-label="重置视角"
            className="tool-button"
            onClick={resetView}
          >
            <RotateCcw size={16} />
          </button>
          <button
            title="机芯说明与展示设置"
            aria-label="机芯说明与展示设置"
            className="tool-button"
            onClick={() => setShowInfo(true)}
          >
            <Info size={16} />
          </button>
        </div>
        {exploded && (
          <div className="explosion-control">
            <div className="slider-label">
              <span>分解程度</span>
              <span>{explosion}%</span>
            </div>
            <Slider
              value={[explosion]}
              min={0}
              max={100}
              step={1}
              aria-label="爆炸分解程度"
              onValueChange={(v) => {
                const amount = Array.isArray(v) ? v[0] : v;
                setExplosion(amount);
                api.current?.explodeAmount(amount / 100);
              }}
            />
          </div>
        )}
      </main>
      <footer className="footer">
        <span>NOCTURNE — INDEPENDENT WATCHMAKING</span>
        <button onClick={() => setShowInfo(true)}>
          机芯运动学研究 <span className="footer-arrow">↗</span>
        </button>
      </footer>
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="info-dialog">
          <DialogTitle className="dialog-title">
            Calibre N.01 <span> / 机芯手记</span>
          </DialogTitle>
          <DialogDescription>
            手动上链、储能与机械时间的交互研究。
          </DialogDescription>
          <div className="dialog-controls">
            <div className="control-row">
              <label htmlFor="labels-toggle">零件悬停标签</label>
              <Switch
                id="labels-toggle"
                checked={labels}
                onCheckedChange={(v) => {
                  setLabels(v);
                  if (!v) setHover(null);
                }}
              />
            </div>
            <div className="control-row">
              <span>机芯演示速度</span>
              <Select
                value={speed}
                onValueChange={(v) => {
                  if (v) {
                    setSpeed(v);
                    api.current?.speed(Number(v));
                  }
                }}
              >
                <SelectTrigger aria-label="机芯演示速度">
                  <SelectValue>
                    {speed === '0.1'
                      ? '0.1× 慢动作'
                      : speed === '60'
                        ? '60× 加速'
                        : '1× 正常走时'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">0.1× 慢动作</SelectItem>
                  <SelectItem value="1">1× 正常走时</SelectItem>
                  <SelectItem value="60">60× 加速</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="dialog-note">
              速度同时作用于轮系、指针与储能消耗。正常走时请选择 1×。
            </p>
          </div>
          <table>
            <thead>
              <tr>
                <th>传动副</th>
                <th>齿数</th>
                <th>从动轮转速</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>条盒 → 中心轮</td>
                <td>96 : 12</td>
                <td>1 圈 / 小时</td>
              </tr>
              <tr>
                <td>中心轮 → 三轮</td>
                <td>80 : 10</td>
                <td>8 圈 / 小时</td>
              </tr>
              <tr>
                <td>三轮 → 四轮</td>
                <td>75 : 10</td>
                <td>1 圈 / 分钟</td>
              </tr>
              <tr>
                <td>四轮 → 擒纵轮</td>
                <td>96 : 8</td>
                <td>12 圈 / 分钟</td>
              </tr>
              <tr>
                <td>分针 → 时针</td>
                <td>10:30 × 8:32</td>
                <td>1 圈 / 12 小时</td>
              </tr>
            </tbody>
          </table>
          <p>
            15 齿擒纵轮每半振动平均转过 12°。条盒每 8 小时一圈，设定 6
            圈有效发条转数，形成 48 小时的模型储能。初始预上链 32
            小时；向上拖动上链、反向空回、满链限位，储能耗尽后机芯停走。
          </p>
          <p className="engineering-note">
            <strong>关于真实可运行性</strong>
            <br />
            这是按机械传动关系构建的运动学模型。齿轮传动、上链与时间联动可运行；弹簧采用形变示意，擒纵采用规定运动。齿形接触、锁值与落差、公差、材料应力和装配干涉尚未经过工程求解或实物验证，因此不能作为已验证的可制造机芯。
          </p>
          <p>
            鼠标拖动旋转，滚轮或 + / −
            缩放；点击零件查看信息。键盘聚焦模型后，方向键旋转，W
            上链。手机可单指旋转、双指缩放。
          </p>
          <div className="source-links">
            <a
              href="https://www.awci.com/wp-content/uploads/ht/1988/1988-08-web.pdf"
              target="_blank"
              rel="noreferrer"
            >
              AWCI · 轮系资料 ↗
            </a>
            <a
              href="https://www.gutenberg.org/files/21978/21978-h/21978-h.htm"
              target="_blank"
              rel="noreferrer"
            >
              Playtner · 杠杆擒纵原理 ↗
            </a>
            <a
              href="https://horopedia.org/motor-organ-power-source/"
              target="_blank"
              rel="noreferrer"
            >
              Horopedia · 发条动力 ↗
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
