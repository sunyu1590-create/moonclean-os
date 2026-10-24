"use client";

import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const ATTACHMENT_BUCKET = "moonclean-service-attachments";

function PrivateImageView({ node, storeId, selected, deleteNode }: NodeViewProps & { storeId: string }) {
  const [imageState, setImageState] = useState<{ path: string; url?: string; failed?: boolean } | null>(null);
  const source = String(node.attrs.src || "");
  const path = source.startsWith("moonclean-attachment://") ? source.slice("moonclean-attachment://".length) : "";
  const external = /^https?:\/\//i.test(source);
  const valid = external || Boolean(storeId && path.startsWith(`${storeId}/notes/`));
  const url = external ? source : imageState?.path === path ? imageState.url || "" : "";
  const failed = !valid || (imageState?.path === path && Boolean(imageState.failed));
  useEffect(() => {
    if (!valid || external) return;
    let cancelled = false;
    void createBrowserSupabaseClient().storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 1800)
      .then(({ data, error }) => { if (cancelled) return; if (error) throw error; setImageState({ path, url: data.signedUrl }); })
      .catch(() => { if (!cancelled) setImageState({ path, failed: true }); });
    return () => { cancelled = true; };
  }, [external, path, valid]);
  return <span className={`note-editor-image ${selected ? "is-selected" : ""}`} contentEditable={false}>
    {url ? <NextImage src={url} alt={String(node.attrs.alt || "笔记图片")} width={1200} height={800} unoptimized loading="lazy"/> : <span>{failed ? "图片暂时无法读取" : "正在加载图片…"}</span>}
    <button type="button" aria-label="移除图片" onClick={deleteNode}>×</button>
  </span>;
}

export function NoteRichEditor({ value, onChange, editable, storeId, onUploadImage, onEditorReady }: {
  value: string;
  onChange: (markdown: string) => void;
  editable: boolean;
  storeId: string | null;
  onUploadImage: () => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}) {
  const extensions = useMemo(() => {
    const PrivateImage = TiptapImage.extend({
      addNodeView() {
        return ReactNodeViewRenderer((props) => <PrivateImageView {...props} storeId={storeId || ""}/>);
      },
    });
    return [
      StarterKit.configure({ link: false, underline: {} }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, isAllowedUri: href => /^(https?:\/\/|mailto:|\/notes\?id=|moonclean-attachment:\/\/)/i.test(href), HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Markdown.configure({ markedOptions: { gfm: true } }),
      PrivateImage.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ];
  }, [storeId]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    contentType: "markdown",
    editable,
    editorProps: {
      attributes: {
        class: "note-tiptap-content",
        "aria-label": "笔记正文",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
  });

  useEffect(() => { editor?.setEditable(editable); }, [editable, editor]);
  useEffect(() => { if (editor) onEditorReady?.(editor); }, [editor, onEditorReady]);
  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  return <div className="note-editor-canvas" onClick={() => editor?.commands.focus()}>
    <EditorContent editor={editor}/>
    {!value && <div className="note-editor-placeholder" aria-hidden="true">记下想法、写一段复盘，或整理成完整笔记…</div>}
    <button type="button" className="sr-only" onClick={onUploadImage}>上传图片</button>
  </div>;
}

export type NoteEditorInstance = ReturnType<typeof useEditor>;
