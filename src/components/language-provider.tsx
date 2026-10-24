"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AppLanguage = "zh-CN" | "en-US";
const LANGUAGE_KEY = "moonclean-language-v1";

const en: Record<string, string> = {
  "经营总览": "Overview", "推广分析": "Advertising", "商品管理": "Products", "订单中心": "Orders",
  "OVERVIEW / 经营总览": "OVERVIEW / BUSINESS SUMMARY", "PERFORMANCE / 推广分析": "PERFORMANCE / ADVERTISING",
  "FINANCE / 财务利润": "FINANCE / PROFIT", "INVENTORY / 库存管理": "INVENTORY / STOCK CONTROL",
  "ORDERS / 订单中心": "ORDERS / ORDER CENTER", "TASKS / 运营待办": "TASKS / OPERATIONS",
  "AFTER-SALES / 售后分析": "AFTER-SALES / ANALYTICS", "SYNC CENTER / 同步任务": "SYNC CENTER / TASKS",
  "AI WORKSPACE / AI 设置": "AI WORKSPACE / SETTINGS", "PREFERENCES / 系统设置": "PREFERENCES / SETTINGS",
  "DATA / 数据中心": "DATA / DATA CENTER", "PRODUCTS / 商品管理": "PRODUCTS / CATALOG",
  "REPORTS / 经营报告": "REPORTS / BUSINESS REVIEW", "NOTES / 运营备忘录": "NOTES / NOTE CENTER",
  "EXPERIMENTS / 运营实验室": "EXPERIMENTS / OPERATIONS LAB", "COMPETITORS / 竞品情报": "COMPETITORS / MARKET INTELLIGENCE",
  "PRICING LAB / 定价模拟": "PRICING LAB / SIMULATOR", "PRODUCT HEALTH / 商品诊断": "PRODUCT HEALTH / INSIGHTS",
  "INTEGRATIONS / 平台连接": "INTEGRATIONS / PLATFORMS", "ACCOUNT / 当前账号": "ACCOUNT / PROFILE",
  "早上好，今天的生意一目了然": "Good morning. See how your business is doing.",
  "从销售、推广到利润，掌握店铺经营节奏。": "Track your store's performance across sales, advertising, and profit.",
  "让每一笔推广费更清楚": "Understand every advertising dollar", "广告效果以归因成交额衡量，与全店销售额分开核算。": "Ad performance is measured by attributed sales, separate from store-wide sales.",
  "看见收入，也看清留下的利润": "See revenue and the profit you keep", "所有经营费用汇总至统一的财务计算模块。": "All operating expenses are consolidated in one financial view.",
  "平台授权与定时同步属于云端功能。": "Platform authorization and scheduled sync are cloud features.",
  "当前为模拟同步模式，尚未连接拼多多官方开放平台。": "Demo sync is enabled. The official Pinduoduo Open Platform is not connected.",
  "调整全站动效和通知表现；设置保存在当前设备。": "Adjust app-wide motion and notifications. Preferences are saved on this device.",
  "预览、选择店铺并确认导入。原始 localStorage 数据不会被删除。": "Preview, choose a store, and confirm the import. Original localStorage data is preserved.",
  "管理店铺资料、经营目标、团队角色与数据备份。": "Manage store details, business goals, team roles, and data backups.",
  "结合近 30 天商品销售、SKU 成本和 SKU 日销量，提示成本缺失、低贡献和退款情况。": "Review 30-day sales, SKU costs, and daily units to spot missing costs, low contribution, and refunds.",
  "可选择在售 SKU，也可临时创建一条规格试算；临时 SKU 和模拟价格都不会写入商品或云端数据。": "Choose an active SKU or create a temporary one to simulate. Temporary SKUs and prices are never saved.",
  "管理商品规格、售价及单件成本，快速查看贡献利润。": "Manage variants, prices, and unit costs to review contribution profit.",
  "售后数据跟随云端平台同步记录；本机工作区不会请求云端退款。": "After-sales records sync with the cloud platform. The local workspace does not request cloud refunds.",
  "按退款原因统计频次和金额，及时发现质量、包装、漏发与物流问题。": "Group refund frequency and value by reason to spot quality, packaging, missing-item, and delivery issues.",
  "集中管理 AI 连接、安全解锁、功能入口、数据使用方式与调用记录。": "Manage AI connections, secure access, features, data use, and request history.",
  "云端平台连接的同步进度与历史记录。": "Sync progress and history for cloud platform connections.",
  "模拟平台任务在服务端执行，进度、游标和错误持久保存在云端。": "Demo platform jobs run server-side. Progress, cursors, and errors are stored in the cloud.",
  "当前本地工作区不保存平台同步订单。": "The local workspace does not store platform-synced orders.",
  "查看平台同步的订单、商品明细和退款。当前拼多多连接为模拟模式，所有订单均为模拟数据。": "View synced orders, item details, and refunds. The current Pinduoduo connection is in demo mode.",
  "每个规格的库存，心中有数": "Know your stock at a glance", "手工维护库存数量与预警线，所有调整保留历史。模拟订单不会自动扣减库存。": "Maintain stock levels and alert thresholds. Adjustments are recorded; demo orders do not deduct stock.",
  "订单进展，一处查看": "Track every order in one place", "同步任务中心": "Sync Center", "平台连接中心": "Platform Integrations",
  "推广趋势": "Advertising trends", "推广效率分析": "Advertising efficiency", "推广记录": "Advertising records",
  "近 30 天数据质量与来源": "Data quality and sources · last 30 days", "历史经营数据": "Business history",
  "经营结论": "Business summary", "每日明细": "Daily details", "利润核算明细": "Profit calculation details",
  "平台 SKU 映射": "Platform SKU mapping", "SKU 映射历史": "SKU mapping history", "官方接入准备": "Official integration setup",
  "最近调整流水": "Recent stock adjustments",
  "尚未建立模拟连接": "No demo connection yet", "立即同步": "Sync now",
  "历史任务": "Task history", "同步日志": "Sync log", "重置模拟同步数据": "Reset demo sync data",
  "个人资料": "Profile", "已登录设备": "Signed-in devices", "登录与安全": "Sign-in & security",
  "全站动效档位": "Global motion level", "页面切换方式": "Page transitions", "操作通知样式": "Notification style",
  "通知入场动效": "Notification entrance animation", "通知动效速度": "Notification speed", "系统动态效果偏好": "System motion preference",
  "店铺信息": "Store information", "经营目标与预警": "Business targets & alerts", "数据管理": "Data management",
  "账号与权限": "Accounts & permissions", "任务列表": "Task list", "迁移预览": "Migration preview",
  "数据保护": "Data protection", "导入结果": "Import results", "调整库存": "Adjust stock",
  "SKU 库存": "SKU inventory", "创建临时 SKU": "Create temporary SKU", "试算输入": "Simulation inputs",
  "单件利润拆解": "Per-unit profit breakdown", "商品表现": "Product performance", "经营诊断": "Business diagnostics",
  "让每天的运营更有条理": "Bring more structure to daily operations", "把售后问题按原因看清楚": "Understand after-sales issues by cause",
  "管理你的账号": "Manage your account", "个人资料、登录邮箱与账号安全设置。": "Manage your profile, sign-in email, and account security.",
  "看清收入，也看清留下的利润": "See revenue and the profit you keep", "先算清每件商品能留下多少": "Calculate the profit each product keeps",
  "把需要关注的商品找出来": "Find the products that need attention", "让工作空间贴合你的店铺": "Set up your workspace for your store",
  "让经营数据有据可查": "Keep your business data traceable", "把商品的每一分利润算清楚": "Understand every part of product profit",
  "把日常数据整理成经营复盘": "Turn daily data into a business review", "把本地经营数据带到云端": "Move local business data to the cloud",
  "建立模拟连接": "Set up a demo connection", "模拟平台操作": "Demo platform actions",
  "商品销售排行": "Product sales ranking", "经营趋势": "Business trends", "近 7 天经营快照": "7-day business snapshot",
  "订单和退款来自平台连接中心，当前设备没有本地订单记录。切换到云端数据后可读取已同步的模拟订单；本地经营日报仍可在数据中心管理。": "Orders and refunds come from platform integrations. This device has no local order records. Switch to cloud data to view synced demo orders. Local daily reports remain available in Data Center.",
  "近 30 天经营快照": "Business snapshot · last 30 days",
  "当前本机工作区没有云端同步的订单与退款。切换到云端数据后，可以分析退款趋势、标注问题原因并生成 AI 总结。": "This local workspace has no cloud-synced orders or refunds. Switch to cloud data to analyze refunds, tag issue causes, and generate AI summaries.",
  "库存管理": "Inventory", "运营待办": "Tasks", "笔记中心": "Notes", "AI 运营助手": "AI Copilot",
  "AI 聊天": "AI Chat", "AI 设置": "AI Settings", "运营实验室": "Experiments", "竞品情报": "Competitors",
  "客服与售后": "Customer Service", "商品诊断": "Product Insights", "定价模拟": "Pricing Simulator",
  "售后分析": "After-sales", "经营报告": "Reports", "财务利润": "Finance & Profit", "数据中心": "Data Center",
  "系统设置": "Settings", "动效设置": "Motion", "平台连接": "Integrations", "同步任务": "Sync Center",
  "本地数据迁移": "Local Data Migration", "账号设置": "Account Settings", "工作空间": "Workspace",
  "更多功能": "More", "常用经营工具与系统管理": "Operations and system tools", "经营工具": "Operations",
  "系统与账号": "System & Account", "自定义底栏": "Customize navigation", "选择常用入口，最多显示 4 个": "Choose up to 4 shortcuts",
  "底栏快捷入口": "Navigation shortcuts", "已选": "Selected", "恢复默认底栏": "Restore defaults",
  "更多": "More", "外观模式": "Appearance", "跟随系统": "System", "深色": "Dark", "浅色": "Light",
  "点击切换": "Click to switch", "店铺名称": "Store name", "创建第一个店铺": "Create your first store",
  "店铺数据会安全保存在云端，并可在手机和电脑间同步。": "Store data is securely saved in the cloud and synced across devices.",
  "当前店铺": "Current store", "云端数据": "Cloud data", "本地数据": "Local data", "当前设备": "This device",
  "所有者": "Owner", "管理员": "Admin", "编辑者": "Editor", "查看者": "Viewer",
  "本地异常": "Local error", "本机保存中…": "Saving locally…", "云端异常": "Cloud error",
  "保存中…": "Saving…", "保存中": "Saving", "切换店铺": "Switch store",
  "切换外观": "Switch appearance", "退出登录": "Sign out", "选择数据存储位置": "Choose data storage",
  "切换只会更改当前读取的数据源，不会自动复制或合并两边的数据。": "Switching changes the active data source. Data is not copied or merged.",
  "当前使用": "Active", "安全保存在云端，手机和电脑可同步，支持店铺与团队协作。": "Securely stored in the cloud, synced across devices, with store and team collaboration.",
  "保存在此设备的浏览器中；不会自动上传或跨设备同步。": "Stored in this device's browser. It is not uploaded or synced.",
  "本地与云端数据相互独立。需要迁移数据时，请使用“本地数据迁移”向导。": "Local and cloud data are separate. Use Local Data Migration to move data.",
  "月明净品牌标志": "MoonClean logo", "月明净 MoonClean OS 首页": "MoonClean OS home",
  "正在加载店铺数据": "Loading store data", "基于当前筛选周期": "Based on the selected period",
  "当前包含模拟数据；平台模拟订单需在连接中心管理": "Demo data is included. Manage simulated platform orders in Integrations.",
  "当前无模拟经营数据": "No demo business data", "导出数据": "Export data", "全部": "All", "搜索": "Search",
  "保存": "Save", "取消": "Cancel", "删除": "Delete", "编辑": "Edit", "新增": "Add", "新建": "New",
  "刷新": "Refresh", "查看": "View", "操作": "Actions", "日期": "Date", "状态": "Status", "来源": "Source",
  "经营表现，清晰可见。": "Business performance at a glance.", "销售、利润与经营目标集中呈现，数据更新后自动同步。": "Sales, profit, and targets in one view, synced as data updates.",
  "本月销售目标": "Monthly sales target", "期间净销售额": "Net sales for period", "估算经营利润": "Estimated operating profit",
  "已完成": "Completed", "经营数据": "Business data", "今日销售额": "Today's sales", "今日订单量": "Today's orders",
  "今日推广消耗": "Today's ad spend", "今日估算经营利润": "Today's estimated profit", "期间经营利润率": "Operating margin",
  "期间广告 ROAS": "Period ROAS", "已扣除退款": "Refunds deducted", "已录入订单": "Orders recorded",
  "来自推广录入": "From advertising records", "含广告及其他费用": "Includes advertising and other expenses",
  "归因成交额 ÷ 广告消耗": "Attributed sales ÷ ad spend", "经营周期对比": "Period comparison",
  "净销售额": "Net sales", "推广消耗": "Ad spend", "两期按相同天数计算": "Both periods use the same number of days",
  "数据不足，无法比较": "Not enough data to compare", "上一周期暂无经营日报": "No daily report for the previous period",
  "与上一周期持平": "Unchanged from previous period", "上升": "up", "下降": "down", "较前期": "vs. previous period",
  "上一周期没有日报记录，不能据此判断趋势。": "There is no report for the previous period, so a trend cannot be determined.",
  "成本字段已完整，仍应结合两期数据覆盖情况解读。": "Cost fields are complete. Interpret results alongside data coverage for both periods.",
  "近": "Last", "天经营快照": "-day business snapshot", "录入": "Add", "导入报表": "Import report",
  "趋势": "Trend", "利润": "Profit", "销售额": "Sales", "退款": "Refunds", "毛利": "Gross profit",
  "订单记录": "Order records", "刷新页面": "Refresh page", "正在读取云端数据": "Loading cloud data",
  "待补录": "Needs entry", "无法计算": "Cannot calculate", "未设置": "Not set", "数据不完整": "Incomplete data",
  "低库存预警": "Low-stock alerts", "在售 SKU": "Active SKUs", "已设库存": "Stock tracked",
  "处理中的": "In progress", "处理中": "Processing", "成功退款金额": "Successful refunds",
  "高频售后问题": "Common after-sales issues",
  "售后处理建议": "After-sales recommendations", "退款记录与问题标注": "Refund records and issue tags",
  "历史利润趋势": "Profit history", "成本结构": "Cost breakdown", "每日利润复核": "Daily profit review",
  "利润质量与效率": "Profit quality and efficiency", "与上一周期对比": "Compare with previous period",
  "服务连接": "Service connection", "数据与隐私": "Data & privacy", "AI 功能目录": "AI feature catalog", "用量与诊断": "Usage & diagnostics",
  "打开动效设置模块": "Open motion settings", "打开 AI 设置模块": "Open AI settings", "性能调试浮窗": "Performance debug overlay",
  "金额": "Amount", "数量": "Quantity", "名称": "Name", "备注": "Notes", "说明": "Description",
  "暂无数据": "No data yet", "暂无记录": "No records yet", "导出": "Export", "导入": "Import",
  "欢迎回来": "Welcome back", "登录 MoonClean OS，继续掌握店铺经营。": "Sign in to MoonClean OS and stay on top of your business.",
  "登录": "Sign in", "创建账号": "Create an account", "先验证邮箱，再开始管理你的店铺。": "Verify your email to get started.",
  "注册账号": "Sign up", "找回密码": "Reset your password", "我们会向你的邮箱发送重置链接。": "We'll email you a password reset link.",
  "发送重置邮件": "Send reset email", "设置新密码": "Set a new password", "为账号设置一个新的安全密码。": "Choose a new secure password for your account.",
  "更新密码": "Update password", "昵称": "Display name", "你的称呼": "How should we address you?", "邮箱": "Email",
  "新密码": "New password", "密码": "Password", "忘记密码？": "Forgot password?", "至少 8 位": "At least 8 characters",
  "请稍候…": "Please wait…", "还没有账号？": "New to MoonClean?", "立即注册": "Create account",
  "返回经营总览": "Back to overview", "返回登录": "Back to sign in", "创建店铺": "Create store", "正在创建…": "Creating…",
  "请先配置 Supabase 项目地址和 Publishable Key": "Configure the Supabase project URL and publishable key first.",
  "请输入有效邮箱地址": "Enter a valid email address", "密码至少 8 位": "Password must be at least 8 characters",
  "注册申请已提交。请查看邮箱中的验证链接，验证后再登录。": "Sign-up submitted. Check your email for a verification link, then sign in.",
  "如果邮箱对应有效账号，重置链接会发送到该邮箱。": "If the email belongs to an account, a reset link will be sent.",
  "密码已更新。请返回经营总览。": "Password updated. Return to the overview.", "网络异常，请稍后重试": "Network error. Please try again later.",
};

export function translateAppText(language: AppLanguage, text: string): string {
  return language === "en-US" ? en[text] || text : text;
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("zh-CN");
  useEffect(() => {
    let frame = 0;
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      if (stored === "zh-CN" || stored === "en-US") {
        frame = window.requestAnimationFrame(() => setLanguageState(stored));
      }
    } catch { /* Keep the default language when storage is unavailable. */ }
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.title = language === "en-US" ? "MoonClean OS · Smart Business" : "MoonClean OS · 月明净智能经营";
  }, [language]);
  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Language still changes for this session. */ }
  }, []);
  const toggleLanguage = useCallback(() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN"), [language, setLanguage]);
  const t = useCallback((text: string) => translateAppText(language, text), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider missing");
  return value;
}

export function useOptionalLanguage() {
  return useContext(LanguageContext);
}
