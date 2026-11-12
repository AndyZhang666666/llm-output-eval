"use client";
import {Button, Menu, MenuItem, MenuTrigger, Popover} from 'react-aria-components';
import {ConfirmReviewAction} from './WorkbenchDialog';

export function ReviewReportActions({disabled, canClear, onMarkdown, onJson, onClear}: {
  disabled:boolean; canClear:boolean; onMarkdown:()=>void; onJson:()=>void; onClear:()=>void;
}) {
  return <div className="report-toolbar">
    <MenuTrigger><Button className="report-export" isDisabled={disabled}>导出本篇复核报告 <span aria-hidden="true">↗</span></Button><Popover className="report-popover" placement="top end"><Menu aria-label="复核报告格式" onAction={key=>key==='markdown'?onMarkdown():onJson()}><MenuItem id="markdown"><b>Markdown · 适合阅读</b><small>先列未解决事项，再附原始评语和人工判断</small></MenuItem><MenuItem id="json"><b>JSON · 适合恢复</b><small>保留原文、原分、引用与独立人工记录</small></MenuItem></Menu></Popover></MenuTrigger>
    <details className="review-secondary"><summary>人工记录管理</summary><ConfirmReviewAction disabled={disabled||!canClear} label="清除本篇复核" title="清除这篇材料的人工复核？" detail="将移除本篇五维的复核状态、备注与人工参考分；模型原始记录、独立处理清单与适用性声明保持。请先导出需要保留的判断，此操作没有自动撤销。" confirmLabel="确认清除本篇人工复核" onConfirm={onClear}/></details>
  </div>;
}
