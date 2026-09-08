/** All angles are viewed from the dial: positive = counterclockwise.
 * Kinematic model, not a spring/contact finite-element solver. */
export const TAU = Math.PI * 2;
export const CALIBRE = Object.freeze({
  beatHz: 6,
  balanceHz: 3,
  escapeTeeth: 15,
  reserveSeconds: 48 * 3600,
  crownTurns: 24,
  usableSpringTurns: 6,
  barrelPeriod: 8 * 3600,
});
export const TRAIN = [
  {
    name: 'barrel',
    wheel: 96,
    pinion: 0,
    period: 28800,
    direction: 1,
    x: -0.85,
    y: 0.85,
    module: (Math.hypot(0.85, 0.85) * 2) / 108,
    z: -0.18,
  },
  {
    name: 'center',
    wheel: 80,
    pinion: 12,
    period: 3600,
    direction: -1,
    x: 0,
    y: 0,
    module: 0.015,
    z: 0.18,
  },
  {
    name: 'third',
    wheel: 75,
    pinion: 10,
    period: 450,
    direction: 1,
    x: 0.675 * Math.cos(-0.55),
    y: 0.675 * Math.sin(-0.55),
    module: 0.015,
    z: 0,
  },
  {
    name: 'fourth',
    wheel: 96,
    pinion: 10,
    period: 60,
    direction: -1,
    x: 0.675 * Math.cos(-0.55) + 0.6375 * Math.cos(-2.15),
    y: 0.675 * Math.sin(-0.55) + 0.6375 * Math.sin(-2.15),
    module: 0.009,
    z: -0.18,
  },
  {
    name: 'escape',
    wheel: 15,
    pinion: 8,
    period: 5,
    direction: 1,
    x: 0,
    y: 0,
    module: 0.035,
    z: 0.13,
  },
];
TRAIN[4].x = TRAIN[3].x + 0.468 * Math.cos(-0.5);
TRAIN[4].y = TRAIN[3].y + 0.468 * Math.sin(-0.5);
export const PARTS = {
  barrel: {
    title: '发条盒与主发条',
    en: 'THE SOURCE OF ENERGY',
    description:
      '内端连接发条轴，外端固定于条盒。上链使发条轴转动；走时由条盒释放能量。棘爪锁住发条轴，阻止能量逆向回退。',
    specs: [
      ['条盒齿数', '96 齿'],
      ['条盒周期', '8 小时 / 圈'],
      ['可用相对转数', '6 圈（容量假设）'],
    ],
  },
  train: {
    title: '传动齿轮系',
    en: 'THE GOING TRAIN',
    description:
      '四级轮系把条盒的缓慢运动传至擒纵轮。每只齿轮与同轴齿轴刚性相连，各啮合副采用匹配模数，并在不同高度交错排列。',
    specs: [
      ['总增速比', '5,760 : 1'],
      ['中心轮', '1 圈 / 小时'],
      ['四轮 / 小秒针', '1 圈 / 分钟'],
    ],
  },
  balance: {
    title: '摆轮与游丝',
    en: 'THE OSCILLATOR',
    description:
      '摆轮往复振荡，游丝提供回复作用。每秒完成 3 次完整振荡，由擒纵叉补充能量；低储能时振幅减小，耗尽后停止。',
    specs: [
      ['振动频率', '3 Hz'],
      ['半振动频率', '6 次 / 秒'],
      ['正常展示振幅', '270°'],
    ],
  },
  escapement: {
    title: '杠杆式擒纵',
    en: 'THE ESCAPEMENT',
    description:
      '擒纵轮依次锁止、解锁、传冲、跌落。擒纵叉在摆轮经过中位时切换，每个半振动平均放行半个齿距。',
    specs: [
      ['擒纵轮', '15 齿'],
      ['每半振动', '12°'],
      ['擒纵轮周期', '5 秒 / 圈'],
    ],
  },
  bridges: {
    title: '镂空夹板与宝石轴承',
    en: 'THE ARCHITECTURE',
    description:
      '镂空主夹板与桥板支承轮轴；红宝石孔石和端石为轮系与摆轴提供低摩擦支点。蓝钢螺钉固定桥板，开放结构显露传动层次。',
    specs: [
      ['桥板饰面', '黑铑 · 倒角抛光'],
      ['轴承', '合成红宝石'],
      ['装配', '双面支承 / 分层布局'],
    ],
  },
  hands: {
    title: '指针与拨针轮系',
    en: 'THE MOTION WORKS',
    description:
      '中心轮驱动分针，经两级减速让时针每 12 小时转一圈。小秒针直连四轮，三根指针由同一个擒纵坐标驱动。',
    specs: [
      ['分针 → 过轮', '10 → 30 齿'],
      ['过轮轴 → 时轮', '8 → 32 齿'],
      ['分针 / 时针', '12 : 1'],
    ],
  },
  crown: {
    title: '手动上链机构',
    en: 'WINDING BY HAND',
    description:
      '向上拖动表冠，立轮与冠轮把转动传至棘轮及发条轴。反向拖动空回；满链限位。拉出表冠进入停秒调时，推回后继续运行。',
    specs: [
      ['上链传动', '12 → 36 → 48'],
      ['冠 / 发条轴', '4 : 1'],
      ['满链所需', '24 圈表冠（模型）'],
    ],
  },
  crystal: {
    title: '蓝宝石水晶与表壳',
    en: 'SAPPHIRE & STEEL',
    description:
      '双面通透的蓝宝石水晶封装机芯。抛光表圈、拉丝表壳与细密刻度构成视线边界；夜光模式呈现冰蓝色指针与时标。',
    specs: [
      ['表壳直径', '42 mm'],
      ['水晶折射率', '1.76'],
      ['夜光', '冰蓝色发光材质'],
    ],
  },
} as const;
export type PartKey = keyof typeof PARTS;
export type Snapshot = {
  reserve: number;
  time: string;
  running: boolean;
  amplitude: number;
  setting: boolean;
  crownTurns: number;
  speed: number;
};
export class Movement {
  reserve = 0;
  elapsed = 0;
  offset = 10 * 3600 + 8 * 60 + 36;
  speed = 1;
  setting = false;
  crownTurns = 0;
  amplitude = 0;
  coastTime = 0;
  advance(dt: number) {
    if (
      !Number.isFinite(dt) ||
      dt <= 0 ||
      !Number.isFinite(this.speed) ||
      this.speed <= 0
    )
      return;
    const actual = this.setting ? 0 : Math.min(this.reserve, dt * this.speed);
    this.elapsed += actual;
    this.reserve = Math.max(0, this.reserve - actual);
    this.coastTime = this.running ? this.elapsed : this.coastTime + dt;
    const goal = this.running
      ? 170 + 100 * Math.min(1, this.reserve / 7200)
      : 0;
    if (this.setting) this.amplitude = 0;
    else this.amplitude += (goal - this.amplitude) * (1 - Math.exp(-dt * 3));
  }
  get running() {
    return this.reserve > 0 && !this.setting;
  }
  get driveBeats() {
    const b = this.elapsed * 6,
      f = b - Math.floor(b),
      x = Math.max(0, Math.min(1, (f - 0.475) / 0.05));
    return Math.floor(b) + x * x * (3 - 2 * x);
  }
  get seconds() {
    return this.offset + this.driveBeats / 6;
  }
  get balanceAngle() {
    return (
      ((this.amplitude * Math.PI) / 180) *
      Math.sin(
        (this.running ? this.elapsed : this.coastTime) * TAU * 3 - Math.PI / 2,
      )
    );
  }
  get forkAngle() {
    const b = this.elapsed * 6,
      n = Math.floor(b),
      f = b - n,
      x = Math.max(0, Math.min(1, (f - 0.465) / 0.07));
    return (n % 2 ? -1 : 1) * (0.085 - 0.17 * x * x * (3 - 2 * x));
  }
  angle(period: number, direction: number) {
    return ((direction * this.driveBeats) / 6 / period) * TAU;
  }
  wind(turns: number) {
    if (this.setting || !Number.isFinite(turns) || turns <= 0) return 0;
    const accepted = Math.min(
      turns,
      (CALIBRE.reserveSeconds - this.reserve) / 7200,
    );
    this.reserve += accepted * 7200;
    this.crownTurns += accepted;
    return accepted;
  }
  setTime(h: number, m: number, s = 0) {
    this.offset =
      ((((h * 3600 + m * 60 + s) % 86400) + 86400) % 86400) -
      this.driveBeats / 6;
  }
  snapshot(): Snapshot {
    const s = Math.floor(((this.seconds % 86400) + 86400) % 86400);
    return {
      reserve: this.reserve,
      time: [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
        .map((n) => String(n).padStart(2, '0'))
        .join(':'),
      running: this.running,
      amplitude: this.amplitude,
      setting: this.setting,
      crownTurns: this.crownTurns,
      speed: this.speed,
    };
  }
}
