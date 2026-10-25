"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { JudgeSettings } from "@/lib/types";
export function SettingsDialog({
  settings,
  onSave,
  onClose,
}: {
  settings: JudgeSettings;
  onSave: (s: JudgeSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null),
    title = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function save(value: JudgeSettings) {
    try {
      onSave(value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置未保存，请检查字段。");
    }
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={title}
      className="settings-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <h2 id={title}>可选接口设置</h2>
        <p>
          默认回放不需要接口。仅手动评测时，文本和Key会发给你填写的服务商；接口还需允许浏览器跨域请求。
        </p>
        <label>
          HTTPS Base URL
          <input
            autoFocus
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            type="url"
          />
        </label>
        <label>
          模型名
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </label>
        <label>
          API Key
          <input
            autoComplete="off"
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          />
        </label>
        <p>
          Key仅保留当前页面内存，刷新即清除。地址与模型名可以保存在本机，不保证所填模型或接口可用。
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="review-actions">
          <button type="button" onClick={() => save({ ...draft, apiKey: "" })}>
            清除Key并使用回放
          </button>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary">
            应用设置
          </button>
        </div>
      </form>
    </dialog>
  );
}
