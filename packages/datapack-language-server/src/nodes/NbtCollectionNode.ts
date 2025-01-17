import { toFormattedString } from '../utils'
import { LintConfig } from '../types/Config'
import { GetFormattedString } from '../types/Formattable'
import { BracketType, GetFormattedClose, GetFormattedOpen, MapNode } from './MapNode'
import { BracketSpacingConfig, SepSpacingConfig } from '../types/StylisticConfig'
import { NbtNode } from './NbtNode'

export abstract class NbtCollectionNode<T extends NbtNode> extends NbtNode implements ArrayLike<T>, Iterable<T> {
	[index: number]: T

	protected abstract configKeys: {
		bracketSpacing: keyof LintConfig,
		sepSpacing: keyof LintConfig,
		trailingPairSep: keyof LintConfig
	}

	protected abstract chars: {
		closeBracket: string,
		openBracket: string,
		sep: string
	}

	length = 0

	push(...values: T[]) {
		for (const value of values) {
			this[this.length++] = value
		}
	}

	*[Symbol.iterator](): Iterator<T, any, undefined> {
		// You want me to call myself for iterating? Stupid!
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i = 0; i < this.length; i++) {
			yield this[i]
		}
	}

	[GetFormattedOpen](lint: LintConfig) {
		const bracketSpacingConfig = lint[this.configKeys.bracketSpacing] as BracketSpacingConfig
		return MapNode.getFormattedBracket(this.length, this.chars.openBracket, BracketType.open, bracketSpacingConfig)
	}

	[GetFormattedClose](lint: LintConfig) {
		const bracketSpacingConfig = lint[this.configKeys.bracketSpacing] as BracketSpacingConfig
		return MapNode.getFormattedBracket(this.length, this.chars.closeBracket, BracketType.close, bracketSpacingConfig)
	}

	[GetFormattedString](lint: LintConfig) {
		const sepSpacingConfig = lint[this.configKeys.sepSpacing] as SepSpacingConfig
		const trailingPairSepConfig = lint[this.configKeys.trailingPairSep] as boolean

		const open = this[GetFormattedOpen](lint)
		const close = this[GetFormattedClose](lint)
		const sep = MapNode.getFormattedSep(this.chars.sep, sepSpacingConfig)

		const content: string[] = []
		for (const value of this) {
			content.push(toFormattedString(value, lint))
		}

		let contentString = content.join(sep)
		if (trailingPairSepConfig) {
			contentString += MapNode.getFormattedSep(this.chars.sep, sepSpacingConfig, true)
		}

		return `${open}${contentString}${close}`
	}
}
