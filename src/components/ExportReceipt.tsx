"use client";
import {useEffect,useState} from 'react';
export function ExportReceipt(){const [file,setFile]=useState<{url:string;name:string}|null>(null);
 useEffect(()=>{const changed=(e:Event)=>setFile((e as CustomEvent<{url:string;name:string}>).detail);window.addEventListener('eval-export',changed);return()=>window.removeEventListener('eval-export',changed);},[]);
 return file?<aside className="export-receipt" role="status">文件已生成；浏览器是否保存请查看下载记录。<a href={file.url} download={file.name}>保存 {file.name}</a><span>这是生成时的快照，后续操作不会修改此文件。</span></aside>:null;
}
