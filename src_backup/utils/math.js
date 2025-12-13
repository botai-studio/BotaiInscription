// 生成随机 GUID
export const generateGUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 计算价格 - 基于bounding box体积
export const calculatePrice = (scaleX, scaleY, scaleZ) => {
  const basePrice = 60; // 基础价格 $60 (对应默认体积 1.0)
  const volume = scaleX * scaleY * scaleZ; // 计算bounding box体积
  const price = basePrice * volume; // 价格与体积成正比
  return price.toFixed(2);
};
