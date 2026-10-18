/**
 * 新增 / 编辑课程：名称、签到点位（地图选点 / 当前位置 / 直接点地图）、距离阈值。
 * 一门课程只有一个点位；阈值默认 50 米。
 */
const api = require('../../../utils/api');
const { toast } = require('../../../utils/ui');

const DEFAULT_RADIUS = 50;
const PRESETS = [30, 50, 100, 200];

/** 根据范围大小挑一个合适的地图缩放级别，让整个圆都在视野里 */
function scaleFor(radius) {
  if (radius <= 40) return 18;
  if (radius <= 90) return 17;
  if (radius <= 180) return 16;
  if (radius <= 380) return 15;
  return 14;
}

Page({
  data: {
    id: '',
    loading: false,
    name: '',
    note: '',
    latitude: 0,
    longitude: 0,
    address: '',
    hasPoint: false,
    coordText: '',
    radius: DEFAULT_RADIUS,
    presets: PRESETS,
    scale: 17,
    markers: [],
    circles: [],
    saving: false,
    delSheet: false,
    deleting: false,
    nameFocus: false
  },

  async onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id, loading: true });
      try {
        const { course } = await api.call('course.get', { id: query.id });
        this.setData({
          name: course.name,
          note: course.note,
          address: course.address,
          radius: course.radius,
          loading: false
        });
        this.setPoint(course.latitude, course.longitude, course.address);
      } catch (e) {
        toast(e.message, 'error');
        setTimeout(() => wx.navigateBack(), 1200);
      }
    } else {
      // 新课程：默认用当前位置作为点位，老师通常就在教室里创建
      this.useCurrent(true);
    }
  },

  // ------------------------------------------------------------ 点位
  setPoint(latitude, longitude, address) {
    const radius = this.data.radius;
    this.setData({
      latitude,
      longitude,
      address: address === undefined ? this.data.address : address,
      hasPoint: true,
      coordText: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      scale: scaleFor(radius),
      markers: [{ id: 1, latitude, longitude, iconPath: '/assets/pin.png', width: 28, height: 36, anchor: { x: 0.5, y: 1 } }],
      circles: [this.circle(latitude, longitude, radius)]
    });
  },

  circle(latitude, longitude, radius) {
    return { latitude, longitude, radius, color: '#2F7D6DFF', fillColor: '#2F7D6D2E', strokeWidth: 2 };
  },

  chooseOnMap() {
    const opts = this.data.hasPoint ? { latitude: this.data.latitude, longitude: this.data.longitude } : {};
    wx.chooseLocation({
      ...opts,
      success: (res) => this.setPoint(res.latitude, res.longitude, res.name || res.address || '地图选点'),
      fail: (e) => {
        if (!/cancel/i.test(e.errMsg || '')) toast('打不开地图选点，请检查定位权限', 'error');
      }
    });
  },

  useCurrent(silent) {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3500,
      success: (res) => {
        this.setPoint(res.latitude, res.longitude, '当前位置');
        if (silent !== true) toast('已使用当前位置');
      },
      fail: () => {
        if (silent !== true) toast('定位失败，请改用地图选点', 'error');
      }
    });
  },

  /** 直接点地图也能改点位（基础库 2.9.0+ 的 map tap 事件带经纬度） */
  onMapTap(e) {
    const { latitude, longitude } = e.detail || {};
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      this.setPoint(latitude, longitude, '地图上点选的位置');
    }
  },

  // ------------------------------------------------------------ 表单
  onName(e) {
    this.setData({ name: e.detail.value });
  },
  onNote(e) {
    this.setData({ note: e.detail.value });
  },
  onRadius(e) {
    this.applyRadius(Number(e.detail.value));
  },
  pickPreset(e) {
    this.applyRadius(Number(e.currentTarget.dataset.v));
  },
  applyRadius(radius) {
    const patch = { radius };
    if (this.data.hasPoint) {
      patch.circles = [this.circle(this.data.latitude, this.data.longitude, radius)];
      patch.scale = scaleFor(radius);
    }
    this.setData(patch);
  },

  // ------------------------------------------------------------ 保存 / 删除
  async save() {
    const { id, name, note, latitude, longitude, address, radius, hasPoint, saving } = this.data;
    if (saving) return;
    if (!name.trim()) {
      toast('请填写课程名称');
      this.setData({ nameFocus: true });
      return;
    }
    if (!hasPoint) {
      toast('请先选择签到点位');
      return;
    }
    this.setData({ saving: true });
    try {
      const payload = { name: name.trim(), note: note.trim(), latitude, longitude, address, radius };
      if (id) await api.call('course.update', { id, ...payload });
      else await api.call('course.create', payload);
      getApp().globalData.dirty.courses = true;
      toast(id ? '修改已保存' : '课程已创建', 'success');
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      toast(e.message, 'error');
      this.setData({ saving: false });
    }
  },

  askDelete() {
    this.setData({ delSheet: true });
  },
  closeDelete() {
    if (!this.data.deleting) this.setData({ delSheet: false });
  },
  async remove() {
    if (this.data.deleting) return;
    this.setData({ deleting: true });
    try {
      const { removedCheckins } = await api.call('course.remove', { id: this.data.id });
      getApp().globalData.dirty.courses = true;
      this.setData({ delSheet: false });
      toast(removedCheckins ? `课程和 ${removedCheckins} 条记录已删除` : '课程已删除', 'success');
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      toast(e.message, 'error');
      this.setData({ deleting: false });
    }
  }
});
