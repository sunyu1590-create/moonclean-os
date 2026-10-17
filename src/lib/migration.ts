import type { AppData } from "./model";
export interface MigrationPreview {
  products: number;
  daily: number;
  advertising: number;
  duplicateDates: string[];
  duplicateProducts: string[];
  alreadyImported: number;
  errors: string[];
}
export function previewMigration(
  local: AppData,
  cloud: AppData,
  imported: { source_kind: string; source_id: string }[],
): MigrationPreview {
  const known = new Set(imported.map((r) => `${r.source_kind}:${r.source_id}`));
  const dates = new Set(cloud.daily.map((r) => r.date));
  const adDates = new Set(cloud.advertising.map((r) => r.date));
  const names = new Set(
    cloud.products.map(
      (p) => `${p.name.toLowerCase()}:${p.category.toLowerCase()}`,
    ),
  );
  const duplicateDates = [
    ...local.daily
      .filter((r) => dates.has(r.date) && !known.has(`daily:${r.id}`))
      .map((r) => `经营 ${r.date}`),
    ...local.advertising
      .filter((r) => adDates.has(r.date) && !known.has(`advertising:${r.id}`))
      .map((r) => `推广 ${r.date}`),
  ];
  const duplicateProducts = local.products
    .filter(
      (p) =>
        names.has(`${p.name.toLowerCase()}:${p.category.toLowerCase()}`) &&
        !known.has(`product:${p.id}`),
    )
    .map((p) => p.name);
  const alreadyImported = [
    ...local.products.map((p) => `product:${p.id}`),
    ...local.daily.map((r) => `daily:${r.id}`),
    ...local.advertising.map((r) => `advertising:${r.id}`),
  ].filter((key) => known.has(key)).length;
  const errors: string[] = [];
  const repeated = (values: string[]) =>
    values.filter((value, index) => values.indexOf(value) !== index);
  if (repeated(local.products.map((p) => p.id)).length)
    errors.push("本地商品 ID 重复");
  if (repeated(local.daily.map((r) => r.date)).length)
    errors.push("本地经营日期重复");
  if (repeated(local.advertising.map((r) => r.date)).length)
    errors.push("本地推广日期重复");
  return {
    products: local.products.length,
    daily: local.daily.length,
    advertising: local.advertising.length,
    duplicateDates,
    duplicateProducts,
    alreadyImported,
    errors,
  };
}
