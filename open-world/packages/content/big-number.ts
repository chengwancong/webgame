// 大数字（docs/build-depth-design.md §7）：伤害、生命、攻击按中文习惯用 万 / 亿 缩写，保留 3 位有效数字。
export function formatBig(value:number):string{
 const n=Math.round(value),abs=Math.abs(n);
 if(abs<10000)return String(n);
 const [unit,base]=abs>=99995000?['亿',1e8]:['万',1e4],scaled=n/base,digits=Math.abs(scaled)>=100?0:Math.abs(scaled)>=10?1:2;
 return scaled.toFixed(digits).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')+unit;
}
