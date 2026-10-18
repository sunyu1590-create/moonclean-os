export const APP_VERSION = "0.2.0";

export const RELEASE_NOTES = [
  {
    version: "0.2.0",
    date: "2026-10-18",
    title: "经营数据采集与分析增强",
    changes: [
      "新增拼多多经营报表与推广报表截图识别，识别后可核对再导入。",
      "日报识别支持成交金额、订单、买家、客单价、访客、转化和退款指标，并同步保存到云端。",
      "新增商品分析、定价模拟、售后分析与经营报告页面。",
      "增加版本检查入口，比较当前预览与 GitHub main 最新提交。",
    ],
  },
] as const;
