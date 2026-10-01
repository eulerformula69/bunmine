
import type { JapaneseTokenizer } from "../types/runtime-types.js";
export const japaneseTokenizerPromiseState = { value: null as Promise<JapaneseTokenizer> | null };
export const japaneseTokenizerInstanceState = { value: null as JapaneseTokenizer | null };

export function getJapaneseTokenizer() {
    if (japaneseTokenizerPromiseState.value) {
        return japaneseTokenizerPromiseState.value;
    }

    japaneseTokenizerPromiseState.value = new Promise<JapaneseTokenizer>((resolve, reject) => {
        if (!window.kuromoji) {
            reject(new Error("kuromoji.js is not loaded"));
            return;
        }

        window.kuromoji.builder({
            dicPath: "/libs/kuromoji/dict/"
        }).build((err, tokenizer) => {
            if (err) {
                reject(err);
                return;
            }

            japaneseTokenizerInstanceState.value = tokenizer;
            console.log("Japanese tokenizer loaded");
            resolve(tokenizer);
        });
    });

    return japaneseTokenizerPromiseState.value;
}

export async function tokenizeJapaneseText(text) {
    const tokenizer = await getJapaneseTokenizer();
    return tokenizer.tokenize(String(text || ""));
}

export function tokenizeJapaneseTextSync(text) {
    if (!japaneseTokenizerInstanceState.value) return null;
    return japaneseTokenizerInstanceState.value.tokenize(String(text || ""));
}
