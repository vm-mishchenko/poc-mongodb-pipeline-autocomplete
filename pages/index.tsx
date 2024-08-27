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
    const [value, setValue]=useState('[]');
    
    const handleEditorDidMount=async (editor: IStandaloneCodeEditor, monaco: Monaco) => {
        new PipelineCompletion(editor, monaco, {
            stagesCompletionProvider: new StagesCompletionProvider(monaco),
            stageCompletionProviders: new Map([
                [StageName.$search, new SearchStageCompletionProvider(monaco)],
            ])
        });
    };
    
    return (
        <div className={styles.app}>
            <h1>MongoDB pipeline autocomplete</h1>
            <div>
                <p>Autocomplete $limit, $search stages + text and compound search operators.</p>
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
            </div>
            
            <div className={styles.description}>
                <div>
                    <h2>Features</h2>
                    <ul>
                        <li>
                            <span>We can build suggestions dynamically based on:</span>
                            <ul>
                                <li>indexed fields</li>
                                <li>documents schema</li>
                                <li>stages added to the pipeline already</li>
                                <li>most popular operators</li>
                                <li>previously used operators per user, session, etc.</li>
                                <li>examples in this POC:</li>
                                <ul>
                                    <li>app doesn't suggest a stage if it was already added to the
                                        pipeline
                                    </li>
                                </ul>
                            </ul>
                        </li>
                        <li>
                            <span>Few autocomplete UX flow:</span>
                            <ul>
                            <li>user selects proposed suggestions without typing, e.g. for
                                    stages
                                </li>
                                <li>user starts typing to get suggestions, e.g. for search operators
                                </li>
                            </ul>
                        </li>
                        <li>
                            Autocomplete for each stage can be added one by one gradually
                        </li>
                    </ul>
                </div>
                
                <div>
                    <h2>How it works</h2>
                    <ul>
                        <li>
                            <span>App registers few types of autocomplete services:</span>
                            <ul>
                                <li><i>general</i> service to suggest the next stage</li>
                                <li><i>stage</i> specific service, e.g. for $search specifically</li>
                            </ul>
                        </li>
                        <li>app parses string to AST tree</li>
                        <li>app finds the focused AST node based on the cursor position</li>
                        <li>app delegates suggestions generation to appropriate service based on the focused node position</li>
                        <li>each service decide how to generate suggestions, e.g. statically, rule
                            based, ml
                        </li>
                        <li>system can be built in an editor abstract way, as soon as the editor returns stage as a string and cursor position (line and column)</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default Home
