"use client";

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Button, Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';

export type MaterialSection = 'history' | 'library' | 'import' | 'external';
const SOURCES: {id:MaterialSection; title:string; detail:string; number:string}[] = [
  {id:'history', title:'历史记录', detail:'先复核一条已保存的评语', number:'01'},
  {id:'library', title:'我的资料库', detail:'继续上次的材料与人工判断', number:'02'},
  {id:'import', title:'导入结果', detail:'上传或粘贴复核 JSON', number:'03'},
  {id:'external', title:'用我的文本送评', detail:'交给已有 AI，再带回结果', number:'04'},
];

// The chooser owns navigation only. Existing panels retain their original draft
// keys and validation; closing a dialog never commits or resets their inputs.
export function MaterialChooser({open, onOpenChange, section, onSectionChange, children}: {
  open:boolean; onOpenChange:(open:boolean)=>void; section:MaterialSection;
  onSectionChange:(section:MaterialSection)=>void;
  children:Record<MaterialSection, ReactNode>;
}) {
  const body=useRef<HTMLDivElement>(null);
  const scrollPositions=useRef<Partial<Record<MaterialSection,number>>>({});
  useEffect(()=>{
    if(!open)return;
    const node=body.current;
    const frame=requestAnimationFrame(()=>{
      node?.querySelectorAll<HTMLDetailsElement>('[data-material-section] > details').forEach(details=>{details.open=true;const summary=details.querySelector('summary');if(summary){summary.tabIndex=-1;summary.setAttribute('aria-disabled','true');}});
      if(node)node.scrollTop=scrollPositions.current[section]||0;
    });
    return()=>cancelAnimationFrame(frame);
  },[open,section]);
  return <ModalOverlay isOpen={open} onOpenChange={onOpenChange} isDismissable className="workbench-overlay">
    <Modal className="material-modal">
      <Dialog aria-label="选择待复核材料" className="workbench-dialog">
        {({close})=><>
          <header className="dialog-heading"><div><p>材料与来源</p><Heading slot="title">从哪里开始复核？</Heading></div><Button className="dialog-close" onPress={close} aria-label="关闭材料选择">关闭 <span aria-hidden="true">×</span></Button></header>
          <p className="dialog-intent">切换材料不改写模型原分。未提交的文字仍保留在本标签页。</p>
          <div className="material-choice-layout">
            <nav className="material-choice-nav" aria-label="材料来源">
              {SOURCES.map(source=><Button key={source.id} autoFocus={section===source.id} aria-pressed={section===source.id} onPress={()=>{if(body.current)scrollPositions.current[section]=body.current.scrollTop;onSectionChange(source.id);}}><span className="source-number">{source.number}</span><span><b>{source.title}</b><small>{source.detail}</small></span><span aria-hidden="true">↗</span></Button>)}
            </nav>
            <div className="material-choice-body" ref={body} onScroll={e=>{scrollPositions.current[section]=e.currentTarget.scrollTop;}}>
              {SOURCES.map(source=><section data-material-section key={source.id} hidden={section!==source.id}>{children[source.id]}</section>)}
            </div>
          </div>
        </>}
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

export function ConfirmReviewAction({disabled, title, detail, label, confirmLabel, onConfirm}: {
  disabled?:boolean; title:string; detail:string; label:string; confirmLabel:string;
  onConfirm:()=>void;
}) {
  const [open,setOpen]=useState(false);
  return <><button disabled={disabled} onClick={()=>setOpen(true)}>{label}</button><ModalOverlay isOpen={open} onOpenChange={setOpen} isDismissable className="workbench-overlay"><Modal className="confirmation-modal"><Dialog role="alertdialog" aria-label={title} className="workbench-dialog">{({close})=><><Heading slot="title">{title}</Heading><p>{detail}</p><div className="confirmation-actions"><Button autoFocus onPress={close}>取消，保留人工判断</Button><Button className="danger-action" onPress={()=>{onConfirm();close();}}>{confirmLabel}</Button></div></>}</Dialog></Modal></ModalOverlay></>;
}
