import type {NextPage} from 'next'
import Editor, {Monaco, OnMount} from '@monaco-editor/react';
import {useState} from "react";
import {editor} from 'monaco-editor';
import styles from '../styles/Home.module.css'
import {
    PipelineCompletion,
    SearchStageCompletionProvider,
    StageName,
    StagesCompletionProvider
} from "../pipeline-completion/pipeline-completion";

export type IStandaloneCodeEditor=Parameters<OnMount>[0];

const monacoEditorJavascriptOptions: editor.IEditorOptions={
    quickSuggestions: true,
    // quickSuggestions: {
    //     other: 'inline'
    // },
    suggestOnTriggerCharacters: false,
    // Cannot disable bracket colorization at the moment.
    // AggregationPipelineEditor component rewrites the styles instead.
    // https://github.com/microsoft/monaco-editor/issues/3829
    bracketPairColorization: {
        enabled: false,
    },
};

export const monacoEditorOptions: editor.IEditorOptions={
    ...monacoEditorJavascriptOptions,
    cursorBlinking: 'blink',
    readOnly: false,
    fontSize: 14,
    roundedSelection: false,
    padding: {
        top: 10,
    },
    automaticLayout: true,
    fixedOverflowWidgets: true,
    suggest: {
        showWords: false,
        preview: true,
        previewMode: 'subwordSmart',
        showInlineDetails: true,
        showStatusBar: true,
        showTypeParameters: true,
        showEnumMembers: false,
        // for js new
        showFields: false,
        showFunctions: false,
        showVariables: false,
        showModules: false, // disables `globalThis`, but also disables user-defined modules
        showKeywords: false, // const, abstract, interface
        showOperators: false,
        // snippetsPreventQuickSuggestions: true
        
    },
    inlineSuggest: {
        showToolbar: 'always',
        enabled: true,
        mode: 'subwordSmart',
        // suppressSuggestions: false,
    },
    minimap: {
        enabled: false,
    },
    wordWrap: 'on',
    showUnused: true,
};

const Home: NextPage=() => {
    const [value, setValue]=useState('');
    
    const handleEditorDidMount=async (editor: IStandaloneCodeEditor, monaco: Monaco) => {
        new PipelineCompletion(editor, monaco, {
            stagesCompletionProvider: new StagesCompletionProvider(monaco),
            stageCompletionProviders: new Map([
                [StageName.$search, new SearchStageCompletionProvider(monaco)],
            ])
        });
    };
    
    return (
        <div className={styles.editor}>
            <Editor
                value={value}
                language="javascript"
                options={monacoEditorOptions}
                onMount={handleEditorDidMount}
                defaultLanguage={'javascript'}
                onChange={(value) => {
                    setValue(value || '');
                }}
            />
        </div>
    )
}

export default Home
