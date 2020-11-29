import deepEqual from 'fast-deep-equal'
import * as fs from 'fs'
import { promises as fsp } from 'fs'
import https from 'https'
import { EOL } from 'os'
import rfdc from 'rfdc'
import { CodeActionKind, CompletionItem, Diagnostic, Position, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { locale } from '../locales'
import { EntityNode } from '../nodes/EntityNode'
import { ParserSuggestion } from '../types'
import { LintConfig } from '../types/Config'
import { GetFormattedString, isFormattable } from '../types/Formattable'
import { getOuterIndex, IndexMapping } from '../types/IndexMapping'
import { ErrorCode, ParsingError } from '../types/ParsingError'
import { QuoteTypeConfig } from '../types/QuoteTypeConfig'
import { DiagnosticConfig, getDiagnosticSeverity } from '../types/StylisticConfig'
import { TextRange } from '../types/TextRange'
import { StringReader } from './StringReader'

/**
 * Convert an array to human-readable message.
 * @param arr An array.
 * @param quoted Whether or not to quote the result. Defaults to `true`
 * @param conjunction The conjunction to use. Defaults to `and`.
 * @returns Human-readable message.
 * @example // Using English
 * arrayToMessage([]) // "nothing"
 * arrayToMessage('foo') // "“foo”"
 * arrayToMessage(['foo']) // "“foo”"
 * arrayToMessage(['bar', 'foo']) // "“bar” and “foo”"
 * arrayToMessage(['bar', 'baz', 'foo']) // "“bar”, “baz”, and “foo”"
 * @example // Using Locale
 * arrayToMessage([], false) // "nothing"
 * arrayToMessage(['A'], false) // "A"
 * arrayToMessage(['A', 'B'], false) // "A{conjunction.and_2}B"
 * arrayToMessage(['A', 'B', 'C'], false) // "A{conjunction.and_3+_1}B{conjunction.and_3+_2}C"
 */
export function arrayToMessage(arr: string | string[], quoted = true, conjunction: 'and' | 'or' = 'and') {
    if (typeof arr === 'string') {
        arr = [arr]
    }
    const getPart = (str: string) => quoted ? locale('punc.quote', str) : str
    switch (arr.length) {
        case 0:
            return locale('nothing')
        case 1:
            return getPart(arr[0])
        case 2:
            return getPart(arr[0]) + locale(`conjunction.${conjunction}_2`) + getPart(arr[1])
        default:
            arr = arr.map(v => getPart(v))
            return `${arr.slice(0, -1).join(locale(`conjunction.${conjunction}_3+_1`))}${locale(`conjunction.${conjunction}_3+_2`)}${arr[arr.length - 1]}`
    }
}

/**
 * Escape characters in a string with `\`.
 * @param str A string.
 * @param quote A string indicating which type of quote should be escaped.
 */
export function escapeString(str: string, quote: '"' | "'" | null = '"') {
    let ans = ''
    for (const char of str) {
        if (char === '\\' || char === quote) {
            ans += `\\${char}`
        } else {
            ans += char
        }
    }
    return ans
}

/**
 * Quote a string.
 * @param inner The inner string.
 * @param quoteType Which quote to use.
 * @param forced Whether to quote regardless.
 */
export function quoteString(inner: string, quoteType: QuoteTypeConfig, forced: boolean) {
    const shouldQuote = forced ||
        !StringReader.canInUnquotedString(inner) ||
        Array.from(inner).every(StringReader.canInNumber) ||
        inner.toLowerCase() === 'false' ||
        inner.toLowerCase() === 'true'
    if (shouldQuote) {
        let quote: "'" | '"'
        switch (quoteType) {
            case 'always double':
                quote = '"'
                break
            case 'always single':
                quote = "'"
                break
            case 'prefer single':
                const containSingleQuote = inner.includes("'")
                if (containSingleQuote) {
                    quote = '"'
                } else {
                    quote = "'"
                }
                break
            case 'prefer double':
            default:
                const containDoubleQuote = inner.includes('"')
                if (containDoubleQuote) {
                    quote = "'"
                } else {
                    quote = '"'
                }
                break
        }
        return `${quote}${escapeString(inner, quote)}${quote}`
    } else {
        return inner
    }
}

export function validateStringQuote(raw: string, value: string, range: TextRange, quoteConfig: DiagnosticConfig<boolean>, quoteTypeConfig: DiagnosticConfig<QuoteTypeConfig>, quoteConfigRule?: keyof LintConfig, quoteTypeConfigRule?: keyof LintConfig): ParsingError[] {
    const ans: ParsingError[] = []
    if (!quoteConfig && !quoteTypeConfig) {
        return ans
    }

    const firstChar = raw.charAt(0)
    const isQuoted = StringReader.isQuote(firstChar)

    const expectedChar = quoteString(value, quoteTypeConfig ? quoteTypeConfig[1] : 'prefer double', true).charAt(0)
    const specificQuoteCode = expectedChar === '"' ? ErrorCode.StringDoubleQuote : ErrorCode.StringSingleQuote

    if (quoteConfig) {
        const [severity, shouldQuoted] = quoteConfig
        if (shouldQuoted !== isQuoted) {
            const message = locale('expected-got',
                shouldQuoted ? locale('quote') : locale('unquoted-string'),
                locale('punc.quote', firstChar)
            )
            ans.push(new ParsingError(
                range,
                quoteConfigRule ? locale('diagnostic-rule', message, locale('punc.quote', quoteConfigRule)) : message,
                true, getDiagnosticSeverity(severity),
                shouldQuoted ? specificQuoteCode : ErrorCode.StringUnquote
            ))
        }
    }

    if (isQuoted && quoteTypeConfig) {
        const severity = quoteTypeConfig[0]
        if (firstChar !== expectedChar) {
            const message = expectedChar === '"' ? locale('quote_prefer_double') : locale('quote_prefer_single')
            ans.push(new ParsingError(
                range,
                quoteConfigRule ? locale('diagnostic-rule', message, locale('punc.quote', quoteTypeConfigRule)) : message,
                true, getDiagnosticSeverity(severity),
                specificQuoteCode
            ))
        }
    }

    return ans
}

/**
 * Convert an array of any to an array of `ParserSuggestion`.
 * @param array An array
 */
export function arrayToCompletions(array: any[], start: number, end: number, cb = (c: ParserSuggestion) => c): ParserSuggestion[] {
    return array.map(v => cb({ label: v.toString(), start, end }))
}

/**
 * Convert specific value to a linted string.
 * @param value Any value.
 */
export function toFormattedString(value: unknown, lint: LintConfig): string {
    if (isFormattable(value)) {
        return value[GetFormattedString](lint)
    } else if (value === undefined || value === null) {
        return ''
    } else {
        return String(value)
    }
}

export function escapeRegex(value: string) {
    return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export function escapeIdentityPattern(value: string) {
    return value.replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&')
}

/* istanbul ignore next */
export function requestText(uri: string) {
    return new Promise<string>((resolve, reject) => {
        https
            .get(uri, res => {
                let data: string = ''
                res.on('data', chunk => {
                    data += chunk
                })
                res.on('end', () => {
                    resolve(data)
                })
            })
            .on('error', e => {
                reject(e)
            })
            .end()
    })
}

/**
 * Get EOL from specific lint config.
 * @param param0 The lint config.
 */
export function getEol({ eol }: LintConfig) {
    switch (eol) {
        case 'CRLF':
            return '\r\n'
        case 'LF':
            return '\n'
        case 'auto':
        default:
            return EOL
    }
}

/**
 * @param titleLocaleKey The locale key of the code action title (without the `code-action.` part).
 */
/* istanbul ignore next */
export function getCodeAction(titleLocaleKey: string, diagnostics: Diagnostic[], content: TextDocument, range: TextRange, newText: string, kind = CodeActionKind.QuickFix, isPreferred = true) {
    return {
        title: locale(`code-action.${titleLocaleKey}`),
        kind, diagnostics, isPreferred,
        edit: {
            documentChanges: [{
                textDocument: { uri: content.uri, version: content.version },
                edits: [{
                    range: {
                        start: content.positionAt(range.start),
                        end: content.positionAt(range.end)
                    },
                    newText
                }]
            }]
        }
    }
}

/**
 * Remap all the indices in the specific ParserSuggestion object by the specific mapping.
 * @param completion The specific ParserSuggestion object. Won't be changed.
 * @param param1 The mapping used to offset.
 * @returns A new cloned CompletionItem.
 */
export function remapParserSuggestion(completion: ParserSuggestion, mapping: IndexMapping): ParserSuggestion
export function remapParserSuggestion(completion: CompletionItem, getPosition: (offset: number) => Position): ParserSuggestion
export function remapParserSuggestion(completion: ParserSuggestion, param1: IndexMapping | ((offset: number) => Position)) {
    const ans = rfdc()(completion)
    if (param1 instanceof Function) {
        if (ans.textEdit) {
            const range = ans.textEdit.range
            ans.start = range.start.character
            ans.end = range.end.character
            range.start = param1(ans.start)
            range.end = param1(ans.end)
        }
    } else {
        if (ans.textEdit) {
            const range = ans.textEdit.range
            range.start.character = getOuterIndex(param1, range.start.character)
            range.end.character = getOuterIndex(param1, range.end.character)
        }
        ans.start = getOuterIndex(param1, ans.start)
        ans.end = getOuterIndex(param1, ans.end)
    }
    return ans
}

/**
 * @param origin Won't be changed.
 * @returns A new CompletionItem.
 */
export function handleCompletionText<T extends CompletionItem>(origin: T, cb: (str: string) => string) {
    let label = origin.label
    let insertText: string | undefined
    let textEdit: TextEdit | undefined
    if (origin.textEdit) {
        textEdit = {
            range: origin.textEdit.range,
            newText: cb(origin.textEdit.newText)
        }
    }
    if (origin.insertText) {
        insertText = cb(origin.insertText)
    }
    if (!origin.textEdit && !origin.insertText) {
        label = cb(origin.label)
    }
    return {
        ...origin,
        label,
        ...insertText && { insertText },
        ...textEdit && { textEdit }
    }
}

export function removeDupliateCompletions(completions: ParserSuggestion[]): ParserSuggestion[] {
    return completions.filter((completion, i) =>
        completions.findIndex(v => deepEqual(completion, v)) === i
    )
}

export function getNbtdocRegistryId(entity: EntityNode): null | string {
    if (entity.variable === 'a' || entity.variable === 'p' || entity.variable === 'r') {
        return 'minecraft:player'
    }
    const firstID = entity.argument.type?.[0]
    if (firstID && !firstID.isTag) {
        return firstID.toString()
    }
    return null
}

export async function pathAccessible(path: string) {
    return fsp.access(path)
        .then(() => true)
        .catch(() => false)
}

export function ensureObj<K extends string, V>(obj: Partial<Record<K, any>>, key: K, val: NonNullable<V>): NonNullable<V> {
    return obj[key] = obj[key] ?? val
}

export async function readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = ''
        fs
            .createReadStream(path, { encoding: 'utf-8', highWaterMark: 128 * 1024 })
            .on('data', chunk => {
                data += chunk
            })
            .on('end', () => {
                resolve(data)
            })
            .on('error', e => {
                reject(e)
            })
    })
}

export function round(number: number, decimalPlace: number) {
    const scale = 10 ** decimalPlace
    return Math.round(number * scale) / scale
}
