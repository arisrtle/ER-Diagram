/**
 * 界面小工具：轻提示、文件下载打开。
 */

/** 在当前页面的 <app-toast id="toast"> 上显示提示；页面没放组件时退回系统提示 */
function toast(message, type = 'info') {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const t = page && page.selectComponent && page.selectComponent('#toast');
  if (t) t.show(message, type);
  else wx.showToast({ title: message, icon: 'none' });
}

/** 轻微震动反馈（部分机型不支持，失败忽略） */
function buzz(type = 'light') {
  if (wx.vibrateShort) wx.vibrateShort({ type, fail() {} });
}

/**
 * 下载云存储里的 Excel 并用微信内置预览打开（右上角菜单可转发、保存）。
 * @param {string} fileID 云文件 ID
 * @param {string} fileName 希望显示的文件名
 */
function openCloudFile(fileID, fileName) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID,
      success(res) {
        let filePath = res.tempFilePath;
        if (fileName) {
          try {
            const target = `${wx.env.USER_DATA_PATH}/${fileName}`;
            const fs = wx.getFileSystemManager();
            try { fs.unlinkSync(target); } catch (e) { /* 不存在 */ }
            fs.copyFileSync(res.tempFilePath, target);
            filePath = target;
          } catch (e) {
            console.warn('重命名文件失败，使用临时文件名', e);
          }
        }
        wx.openDocument({ filePath, fileType: 'xlsx', showMenu: true, success: resolve, fail: reject });
      },
      fail: reject
    });
  });
}

module.exports = { toast, buzz, openCloudFile };
