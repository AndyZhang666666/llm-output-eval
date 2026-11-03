import DemoUtilities from './DemoUtilities';
export default function EvalHelp(){return <DemoUtilities project="eval" name="Eval Lab" steps={[
 {title:'从一条异常记录开始',description:'打开已存在的历史记录，核对结构评语和原文引用。历史分数不是本站新运行。',href:'/llm-output-eval/?sample=e06&dimension=structure'},
 {title:'留下你的复核',description:'定位人工判断，选择证据状态；可选人工参考分独立于原分。引导只定位，不替你选择。',target:'.evidence-review .review-decisions input',href:'/llm-output-eval/?sample=e06&dimension=structure#evidence-review'},
 {title:'对照一组 AIGC 规则',description:'同一输入下比较两套规则、输出和引用。冻结合成资料演示判断方式，不宣称模型提升。',href:'/llm-output-eval/aigc/'},
 ]} about={{problem:'创意文本评测给出总分后，人仍需核对评语和原文。这里帮助作者检查依据、记录分歧，再决定准备修改什么。',choices:'限定既有创意文本五维；原模型分数不可被复核覆盖。引用定位只解决可查，不替代论证；人工参考、状态与处理项各自独立。',boundary:'默认有来源的历史回放；外部导入未经认证，合成 AIGC 单独标示。可选接口只在明确请求时调用；五维等权及锚点不是经本轮研究认证的通用质量标准。',validation:'需要独立标注者、未参与调参的文本及不同创作情景验证评分有效性；还需测试新用户能否独立完成外部任务搬运。走查不证明模型准确率或发布可用性。'}}/>;}
