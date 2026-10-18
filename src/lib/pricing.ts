import Decimal from "decimal.js";
import type { SKUCost } from "@/lib/model";

export type PricingInput = {
  price: string;
  cost: SKUCost;
  variableFeeRate: string;
  targetMargin: string;
};

export function calculatePricing(input: PricingInput) {
  const price = new Decimal(input.price);
  const variableFeeRate = new Decimal(input.variableFeeRate).div(100);
  const targetMargin = new Decimal(input.targetMargin).div(100);
  const productCost = new Decimal(input.cost.production);
  const packagingCost = new Decimal(input.cost.packaging);
  const shippingCost = new Decimal(input.cost.logistics);
  const platformCost = new Decimal(input.cost.platform);
  const fixedCost = productCost.plus(packagingCost).plus(shippingCost).plus(platformCost);
  const variableCost = price.mul(variableFeeRate);
  const contribution = price.minus(fixedCost).minus(variableCost);
  const margin = price.gt(0) ? contribution.div(price).mul(100) : null;
  const breakEvenRoas = contribution.gt(0) ? price.div(contribution) : null;
  const targetDenominator = new Decimal(1).minus(targetMargin).minus(variableFeeRate);
  const targetPrice = targetDenominator.gt(0) ? fixedCost.div(targetDenominator) : null;
  return { price, productCost, packagingCost, shippingCost, platformCost, fixedCost, variableCost, contribution, margin, breakEvenRoas, targetPrice };
}

export function isMoneyInput(value: string): boolean {
  return /^\d+(\.\d{0,2})?$/.test(value);
}

export function isRateInput(value: string, max = 99): boolean {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return false;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= max;
}
