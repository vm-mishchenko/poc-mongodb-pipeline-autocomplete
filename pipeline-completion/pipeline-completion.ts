import {Monaco} from '@monaco-editor/react';
import {editor, IRange, languages, Position} from 'monaco-editor';
import {Identifier, ObjectExpression, Program, Token} from "acorn";
import {parse} from "acorn-loose";
import IStandaloneCodeEditor=editor.IStandaloneCodeEditor;
import ICursorPositionChangedEvent=editor.ICursorPositionChangedEvent;
import CompletionItemLabel=languages.CompletionItemLabel;

const searchInsertText=`\\$search: {
    index: 'default',
    text: {
        query: "\${1:search query}",
        // search across all string type fields
        path: {
            wildcard: "*"
        }
    }
}`

const limitInsertText=`\\$limit: \${1:10}`

const textInsertText=`text: {
    query: "\${1:search query}",
    // search across all string type fields
    path: {
        wildcard: "*"
    }
}`

const compoundInsertText=`compound: {
    should: [
        {
            text: {
                query: "\${1:search query}",
                path: {
                    wildcard: "*"
                }
            }
        }
    ],
    shouldNot: [],
    must: [],
    mustNot: [],
}`

export enum StageName {
    $search='$search',
    $limit='$limit',
}

interface CompletionProvider {
    getSuggestions: (range: IRange, pipelineAST: PipelineAST) => Promise<languages.CompletionItem[]>
}

interface StageCompletionProvider extends CompletionProvider {
    stageName: StageName
}

export interface PipelineCompletionOptions {
    stagesCompletionProvider?: CompletionProvider
    stageCompletionProviders: Map<StageName, StageCompletionProvider>
}

export class StagesCompletionProvider implements CompletionProvider {
    constructor(private monaco: Monaco) {
    }
    
    getSuggestions(range: IRange, pipelineAST: PipelineAST) {
        const existingStageNames=pipelineAST.getStageNames();
        
        const searchCompletionItem: languages.CompletionItem={
            label: {
                label: '$search',
                description: '$search description',
                detail: ' -> $search detail'
            },
            kind: this.monaco.languages.CompletionItemKind.Snippet,
            detail: 'full text search',
            documentation: {
                value: "The NULLIF function... [see Google](https://www.google.com)"
            },
            insertText: searchInsertText,
            insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: 'a',
            range
        };
        const limitCompletionItem: languages.CompletionItem={
            label: {
                label: '$limit',
                description: '$limit description',
                detail: ' -> $limit detail'
            },
            kind: this.monaco.languages.CompletionItemKind.Snippet,
            detail: 'limit num of docs',
            documentation: {
                value: "$limit markdown [see Google](https://www.google.com)"
            },
            insertText: limitInsertText,
            insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: 'b',
            range
        };
        const suggestions=[
            searchCompletionItem,
            limitCompletionItem,
        ];
        const newSuggestions=suggestions.filter((suggestion) => {
            return !existingStageNames.includes((suggestion.label as CompletionItemLabel).label as StageName)
        })
        return Promise.resolve(newSuggestions);
    }
}

export class SearchStageCompletionProvider implements StageCompletionProvider {
    stageName=StageName.$search;
    
    constructor(private monaco: Monaco) {
    }
    
    getSuggestions(range: IRange) {
        const textOperatorCompletionItem: languages.CompletionItem={
            label: {
                label: 'text',
                description: 'text description',
                detail: ' -> text detail'
            },
            kind: this.monaco.languages.CompletionItemKind.Snippet,
            detail: 'search in text fields',
            documentation: {
                value: "text markdown [see Google](https://www.google.com)"
            },
            insertText: textInsertText,
            insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
        };
        const compoundOperatorCompletionItem: languages.CompletionItem={
            label: {
                label: 'compound',
                description: 'compound description',
                detail: ' -> compound detail'
            },
            kind: this.monaco.languages.CompletionItemKind.Snippet,
            detail: 'compound details',
            documentation: {
                value: "compound markdown [see Google](https://www.google.com)"
            },
            insertText: compoundInsertText,
            insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
        };
        const suggestions=[
            textOperatorCompletionItem,
            compoundOperatorCompletionItem,
        ];
        return Promise.resolve(suggestions);
    }
}

export class PipelineCompletion {
    private options: PipelineCompletionOptions;
    
    constructor(private editor: IStandaloneCodeEditor,
                private monaco: Monaco,
                options?: Partial<PipelineCompletionOptions>) {
        this.options={
            stagesCompletionProvider: undefined,
            stageCompletionProviders: new Map(),
            ...options,
        }
        // show autocomplete suggestions if available for current cursor position
        this.editor.onDidChangeCursorPosition((e: ICursorPositionChangedEvent) => {
            if (e.reason !== 0 || e.source !== 'keyboard') {
                return;
            }
            
            (this.editor as any)._triggerCommand('editor.action.triggerSuggest', {auto: true})
        });
        
        // don't show javascript primitive types in autocomplete
        this.monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            noLib: true,
            allowNonTsExtensions: true
        });
        
        // register custom pipeline completion provider
        this.monaco.languages.registerCompletionItemProvider('javascript', {
            // triggerCharacters: ['$'],
            provideCompletionItems: async (model, position) => {
                const [cursorNode, ast]=getCursorNode(model, position);
                if (!cursorNode) {
                    return {suggestions: []};
                }
                
                const completionProvider=this.findCompletionProvider(cursorNode);
                if (!completionProvider) {
                    return {suggestions: []};
                }
                
                const word=model.getWordUntilPosition(position);
                const range: IRange={
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                }
                
                const pipelineAST=new PipelineAST(ast);
                const suggestions=await completionProvider.getSuggestions(range, pipelineAST);
                return {suggestions};
            },
        });
    }
    
    findCompletionProvider(cursorNode: Token): CompletionProvider | undefined {
        const stageName=this.isCursorPositionSuitableForStageProvider(cursorNode);
        if (stageName) {
            if (!this.options.stageCompletionProviders.has(stageName)) {
                console.log('Cannot find completion provider for stage', stageName);
                return;
            }
            return this.options.stageCompletionProviders.get(stageName);
        }
        
        if (this.isCursorPositionSuitableForStagesProvider(cursorNode)) {
            return this.options.stagesCompletionProvider;
        }
    }
    
    private isCursorPositionSuitableForStagesProvider(cursorNode: Token): boolean {
        let path='';
        let currentNode=cursorNode;
        
        while (currentNode) {
            path=`${path}.${currentNode.type}`;
            currentNode=currentNode.parent;
        }
        
        const isSupportedPath=[
            '.ObjectExpression.ExpressionStatement.Program',
            '.Identifier.Property.ObjectExpression.ExpressionStatement.Program'
        ].includes(path)
        if (!isSupportedPath) {
            return false;
        }
        
        if (cursorNode && cursorNode.type === 'Identifier') {
            if (cursorNode.parent.type === 'Property' && cursorNode.parent.parent.type === 'ObjectExpression' && cursorNode.parent.parent.properties.length < 2) {
                return true;
            }
        }
        
        if (cursorNode && cursorNode.type === 'ObjectExpression' && cursorNode.end -
            cursorNode.start > 2 && cursorNode.properties.length === 0) {
            return true;
        }
        return false;
    }
    
    private isCursorPositionSuitableForStageProvider(cursorNode: Token): StageName | undefined {
        if (cursorNode.type !== 'Identifier') {
            return;
        }
        if (cursorNode.parent.type !== 'Property') {
            return;
        }
        if (cursorNode.parent.parent.type !== 'ObjectExpression') {
            return;
        }
        if (cursorNode.parent.parent.parent.type !== 'Property') {
            return;
        }
        if (cursorNode.parent.parent.parent.parent.type !== 'ObjectExpression') {
            return;
        }
        
        const obj=cursorNode.parent.parent.parent.parent;
        
        if (obj.properties.length === 1) {
            const property=obj.properties[0];
            const isStageName=[
                StageName.$search,
                StageName.$limit
            ].includes(property.key.name)
            if (isStageName) {
                return property.key.name;
            }
        }
        
        return;
    }
}

const getCursorNode=(model: editor.ITextModel, position: Position): [Token, Program] => {
    const pipeline=model.getValue();
    
    // Add parent links to the AST
    const cursorLinePosition=position.lineNumber;
    const cursorColumnPosition=position.column - 1;
    let cursorToken: Token | undefined;
    const addParentLinks=(node: Token, parent: any=null) => {
        const insideNode=node.loc && cursorLinePosition > node.loc.start.line && cursorLinePosition < node.loc.end.line
        if (insideNode) {
            cursorToken=node;
        }
        
        const onStartLine=cursorLinePosition === node!.loc.start.line;
        if (onStartLine && cursorColumnPosition >= node.loc.start.column && cursorColumnPosition <= node.loc.end.column) {
            cursorToken=node;
        }
        
        const onEndLine=cursorLinePosition === node!.loc.end.line;
        if (onEndLine && cursorColumnPosition >= node.loc.start.column && cursorColumnPosition <= node.loc.end.column) {
            cursorToken=node;
        }
        
        switch (node.type) {
            case 'Program':
            case 'BlockStatement': {
                node!.body.forEach((child: any) => {
                    addParentLinks(child, node);
                });
                break;
            }
            case 'ExpressionStatement':
                node.parent=parent;
                
                switch (node.expression.type) {
                    case 'ArrayExpression':
                        node.expression.elements.forEach((child: any) => {
                            addParentLinks(child, node);
                        })
                        break;
                }
                break;
            case 'ObjectExpression': {
                node.parent=parent;
                node.properties.forEach((child: any) => {
                    addParentLinks(child, node);
                });
                break;
            }
            case 'Property': {
                node.parent=parent;
                
                if (node.key) {
                    addParentLinks(node.key, node);
                }
                
                if (node.value) {
                    addParentLinks(node.value, node);
                }
                break;
            }
            case 'Identifier':
                node.parent=parent;
                break;
        }
    }
    
    const ast=parse(pipeline, {
        ecmaVersion: 'latest',
        locations: true,
        preserveParens: true,
        // onToken: (token) => {
        //     if (!token.loc) {
        //         console.error('Token has not position', token);
        //         return;
        //     }
        //
        //     if (token.loc.start.line !== position.lineNumber) {
        //         return;
        //     }
        //
        //     if (cursorColumnPosition >= token.loc.start.column && cursorColumnPosition
        // <= token.loc.end.column) { if (cursorToken) { console.error('token already
        // defined'); return; } console.log('define token') cursorToken=token; } }
    })
    
    addParentLinks(ast)
    console.log(cursorToken)
    
    return [cursorToken!, ast]
}

class PipelineAST {
    constructor(private ast: Program) {
    }
    
    getStageNames(): Array<StageName> {
        if (this.ast.body.length !== 1) {
            return [];
        }
        
        const expressionStatement=this.ast.body[0];
        if (expressionStatement.type !== 'ExpressionStatement') {
            return [];
        }
        
        const objectExpression=expressionStatement.expression;
        if (objectExpression.type !== 'ArrayExpression') {
            return [];
        }
        
        const stages=objectExpression.elements;
        
        const objectExpressionStages=stages.filter((stage) => {
            return stage && stage.type === 'ObjectExpression'
        }) as Array<ObjectExpression>;
        
        const stageNames=objectExpressionStages.filter((objectExpressionStage) => {
            return objectExpressionStage.properties.length === 1;
        }).map((objectExpressionStage) => {
            return objectExpressionStage.properties[0]
        }).filter((property) => {
            return property.type === 'Property'
        }).filter((property) => {
            return property.key.type === 'Identifier';
        }).map((property) => {
            return (property.key as Identifier).name;
        }).filter((stageName) => {
            return [
                StageName.$search,
                StageName.$limit
            ].includes(stageName as StageName);
        })
        
        return stageNames as Array<StageName>;
    }
}
