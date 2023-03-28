export function getModalId(postId: number) {
    return JS_MODAL_ID.formatUnicorn({
        postId: postId
    });
}

export type ModFlagRadioType = 'mod-flag' | 'plagiarism';