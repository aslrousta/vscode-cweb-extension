/**
 * CWEB Extension for Visual Studio Code
 * Copyright (C) 2021  Ali AslRousta <aslrousta@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Context } from 'mocha';
import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
    const types = [
        'comment', 'enum', 'enumMember', 'function', 'keyword', 'label',
        'macro', 'number', 'operator', 'parameter', 'property', 'string',
        'struct', 'type', 'variable',
    ];
    types.forEach((type, index) => tokenTypes.set(type, index));
    const modifiers = [
        'declaration', 'definition', 'documentation', 'modification',
        'readonly', 'static',
    ];
    modifiers.forEach((modifier, index) => tokenModifiers.set(modifier, index));
    return new vscode.SemanticTokensLegend(types, modifiers);
})();

interface IToken {
    line: number;
    start: number;
    length: number;
    type: string;
    modifiers: string[];
}

enum Mode { tex = 1, code };

class SemanticTokenProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(doc: vscode.TextDocument, cancel: vscode.CancellationToken) {
        const builder = new vscode.SemanticTokensBuilder();
        this._parse(doc.getText(), cancel).forEach((token) => builder.push(
            token.line, token.start, token.length,
            this._encodeType(token.type),
            this._encodeModifiers(token.modifiers),
        ));
        return builder.build();
    }

    private _parse(text: string, cancel: vscode.CancellationToken): IToken[] {
        let tokens: IToken[] = [];
        let mode = Mode.tex;
        let i = 0;
        const lines = text.split(/\r?\n/);
        while (i < lines.length && !cancel.isCancellationRequested) {
            const line = lines[i];
            switch (mode as Mode) {
                case Mode.code:
                    if (line.startsWith('@*') || line.startsWith('@ ')) {
                        mode = Mode.tex;
                    } else {
                        mode = this._parseCode(tokens, i, line);
                        i++;
                    }
                    break;
                default:
                    mode = this._parseTeX(tokens, i, line);
                    i++;
            }
        }
        return tokens;
    }

    private _parseCode(tokens: IToken[], i: number, line: string): Mode {
        return Mode.code;
    }

    private _parseTeX(tokens: IToken[], i: number, line: string): Mode {
        if (line.startsWith('%')) {
            tokens.push({
                line: i, start: 0, length: line.length,
                type: 'comment', modifiers: [],
            });
        } else if (line.startsWith('@*')) {
            let dot = line.indexOf('.');
            if (dot < 0) { dot = line.length; }
            tokens.push({
                line: i, start: 0, length: dot,
                type: 'keyword', modifiers: [],
            });
        } else if (line.startsWith('@ ')) {
            tokens.push({
                line: i, start: 0, length: 1,
                type: 'keyword', modifiers: [],
            });
        } else if (line.startsWith('@c')) {
            tokens.push({
                line: i, start: 0, length: line.length,
                type: 'keyword', modifiers: [],
            });
            return Mode.code;
        } else if (line.startsWith('@<') || line.startsWith('@(')) {
            tokens.push({
                line: i, start: 0, length: line.length,
                type: 'keyword', modifiers: [],
            });
            return Mode.code;
        }
        return Mode.tex;
    }

    private _encodeType(type: string) {
        return tokenTypes.get(type)!;
    }

    private _encodeModifiers(modifiers: string[]): number {
        let result = 0;
        modifiers.forEach((modifier) => {
            result |= 1 << tokenModifiers.get(modifier)!;
        });
        return result;
    }
};

export function activate(context: vscode.ExtensionContext) {
    const selector: vscode.DocumentFilter = { language: 'cweb' };
    const tokenProvider = new SemanticTokenProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(selector, tokenProvider, legend)
    );
}
