import type {EvaluationResult} from './types';
import {SCORED_DIMENSIONS} from './dimensions';
export const AIGC_INPUT='写一段短剧：阿宁在即将拆除的车站等失约十年的父亲。她收到没有署名的信，信里只有“别等了”。结尾保留寄件人疑问；不要补造父亲死亡或亲属身份。';
const make=(scores:number[],comments:string[],quotes:string[]):EvaluationResult=>({dimensions:SCORED_DIMENSIONS.map((id,i)=>({id,score:scores[i] as 1|2|3|4|5,comment:comments[i],evidence:[quotes[i]]})),overall:scores.reduce((a,b)=>a+b,0)/5,safety:{category:'none',needs_review:false,comment:'合成示例的人工编写分类，不是安全评测结果。',evidence:[]},meta:{model:'人工编写的冻结合成夹具（未调用模型）',at:'2026-11-03T00:00:00.000Z',sample:true}});
export const AIGC_VERSIONS=[
 {id:'v1',title:'V1 · 先追求结局完整',rules:'让冲突闭合，解释信从何而来。未单独检查“不要补造身份”的约束。',output:'阿宁攥着信，走进候车室。“父亲不会回来了。”站长说，她这才知道父亲十年前已去世。信是母亲寄来的。她哭了一场，决定不再等。',result:make([3,3,2,2,4],['动机清楚，但决定转变来得很快。','从得知消息到离开连贯，却违背来源约束。','信息集中在解释，缺少行动停顿。','站长台词承担说明，缺少互动。','说明了父亲去向和寄件人，结尾闭合。'],['她哭了一场，决定不再等。','信是母亲寄来的。','她这才知道父亲十年前已去世。','“父亲不会回来了。”站长说','信是母亲寄来的。'])},
 {id:'v2',title:'V2 · 先检查输入约束',rules:'先列不可补造的身份与事实；以人物行动推进；生成后核对结尾是否保留疑问。评分仍使用既有五维。',output:'拆除通知贴在钟下。阿宁把“别等了”那封信翻过来，背面没有字。\n“末班车还来吗？”她问。\n站长收起钥匙：“今天不来了。”\n她走到门边，又把信折好，夹回那张旧车票里。远处响起刹车声。她没有回头。',result:make([4,4,4,3,3],['旧车票和收信动作保留了等待的习惯。','围绕停运现场展开，没有新增寄件人身份。','环境、问答、离开形成不同节拍。','问车而非直接追问父亲，仍需更多对话验证。','结尾保留寄件人疑问；不能用闭合度独自判定更好。'],['又把信折好，夹回那张旧车票里。','背面没有字。','站长收起钥匙：“今天不来了。”','“末班车还来吗？”她问。','远处响起刹车声。她没有回头。'])},
];
