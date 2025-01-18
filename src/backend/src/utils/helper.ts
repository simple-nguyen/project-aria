export const parseDepthFloats = ([price, quantity]: string[]) => [parseFloat(price), parseFloat(quantity)];
export const sortDepthAsc = (a: number[], b: number[]) => a[0] - b[0];
export const sortDepthDesc = (a: number[], b: number[]) => b[0] - a[0];
export const reduceDepthWithTotal = (acc: number[][], [price, quantity]: number[]) => {
    const total = (acc.length > 0 ? acc[acc.length - 1][2] : 0) + quantity;
    acc.push([price, quantity, total]);
    return acc;
}