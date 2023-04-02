import {
    flagInNeedOfModeratorIntervention,
    flagPlagiarizedContent
} from 'se-ts-userscript-utilities/FlaggingAndVoting/PostFlags';
import {deletePost} from 'se-ts-userscript-utilities/FlaggingAndVoting/PostVotes';
import {deleteAsPlagiarism} from 'se-ts-userscript-utilities/Moderators/HandleFlags';
import {
    assertValidCommentTextLength,
    assertValidModFlagTextLength,
    assertValidPlagiarismFlagTextLengths,
    commentTextLengthBounds,
    modFlagTextLengthBounds,
    plagiarismFlagLengthBounds
} from 'se-ts-userscript-utilities/Validators/TextLengthValidators';
import {removeModalFromDOM} from 'se-ts-userscript-utilities/StacksHelpers/StacksModal';
import {getModalId, type ModFlagRadioType} from '../Globals';
import {type ActionEvent} from '@hotwired/stimulus';
import {addComment} from 'se-ts-userscript-utilities/Comments/Comments';


interface FlagTemplateConfig {
    flagType: ModFlagRadioType;
    flagDetailTemplate: string;
    enableComment: boolean;
    commentTextTemplate: string;
}


const gmConfigKey = 'fadh-config';
const defaultFlagTemplateConfig = JSON.stringify(<FlagTemplateConfig>{
    flagType: 'mod-flag',
    flagDetailTemplate: '',
    enableComment: false,
    commentTextTemplate: ''
});


export const fadhController = {
    targets: DATA_TARGETS,
    getFlagType(postId: number) {
        return document.querySelector<HTMLInputElement>(`input[name="${FLAG_RADIO_NAME.formatUnicorn({postId})}"]:checked`).value as ModFlagRadioType;
    },
    get plagiarismFlagOriginalSourceText() {
        return this[PLAGIARISM_FLAG_ORIGINAL_SOURCE_TEXT_TARGET].value ?? '';
    },
    get plagiarismFlagDetailText() {
        return this[PLAGIARISM_FLAG_DETAIL_TEXT_TARGET].value ?? '';
    },
    get modFlagDetailText() {
        return this[MOD_FLAG_DETAIL_TEXT_TARGET].value ?? '';
    },
    _getRelevantDetailText(flagType: ModFlagRadioType) {
        switch (flagType) {
            case 'mod-flag':
                return this.modFlagDetailText;
            case 'plagiarism':
                return this.plagiarismFlagDetailText;
            default:
                throw new Error('Invalid flag type; no corresponding text field found');
        }
    },
    _getRelevantEnableToggleTarget(flagType: ModFlagRadioType) {
        switch (flagType) {
            case 'mod-flag':
                return ENABLE_MOD_FLAG_RADIO;
            case 'plagiarism':
                return ENABLE_PLAGIARISM_FLAG_RADIO;
            default:
                throw new Error('Invalid flag type; no corresponding enable toggle found');
        }
    },
    get shouldComment() {
        return this[ENABLE_COMMENT_TOGGLE_TARGET].checked as boolean;
    },
    get commentText() {
        return this[COMMENT_TEXT_TARGET].value ?? '';
    },
    _hideTargetDiv(target: string) {
        $(this[target]).addClass('d-none');
    },
    _showTargetDiv(target: string) {
        $(this[target]).removeClass('d-none');
    },
    _setupFlagUI(flagType: ModFlagRadioType, baseDetailText?: string) {
        if (!SUPPORTS_PLAGIARISM_FLAG_TYPE.includes(StackExchange.options.site.id)) {
            // Disable option
            this[ENABLE_PLAGIARISM_FLAG_RADIO].disabled = true;
            // If flag type is plagiarism set some defaults instead
            if (flagType === 'plagiarism') {
                flagType = 'mod-flag';
                baseDetailText = undefined;
            }
        }
        const radioTarget = this._getRelevantEnableToggleTarget(flagType);
        this[radioTarget].checked = true;
        const {
            fadhNukePostFormHidesParam,
            fadhNukePostFormShowsParam,
            fadhNukePostFormTextareaParam,
        } = $(this[radioTarget]).data();
        this._hideTargetDiv(fadhNukePostFormHidesParam + 'Target');
        this._showTargetDiv(fadhNukePostFormShowsParam + 'Target');
        this[`${fadhNukePostFormTextareaParam}Target`].value = baseDetailText ?? '';
    },
    _setupCommentUI(shouldComment: boolean, baseCommentText?: string) {
        this[ENABLE_COMMENT_TOGGLE_TARGET].checked = shouldComment;
        if (shouldComment) {
            this._showTargetDiv(COMMENT_CONTROL_FIELDS_TARGET);
            this[COMMENT_TEXT_TARGET].value = baseCommentText ?? '';
        } else {
            this._hideTargetDiv(COMMENT_CONTROL_FIELDS_TARGET);
        }
    },
    _setupCharCounter(taTarget: string, bounds: { min: number; max: number; }) {
        const jTextarea = $(this[taTarget]);
        jTextarea
            .charCounter({
                ...bounds,
                target: jTextarea.parent().find('span.text-counter')
            })
            .trigger('charCounterUpdate');
    },
    connect() {
        const loadedConfig: FlagTemplateConfig = JSON.parse(
            GM_getValue(gmConfigKey, defaultFlagTemplateConfig)
        );
        this._setupFlagUI(loadedConfig.flagType, loadedConfig.flagDetailTemplate);
        this._setupCommentUI(loadedConfig.enableComment, loadedConfig.commentTextTemplate);

        // Set up char counters
        this._setupCharCounter(PLAGIARISM_FLAG_DETAIL_TEXT_TARGET, plagiarismFlagLengthBounds.explanation);
        this._setupCharCounter(MOD_FLAG_DETAIL_TEXT_TARGET, modFlagTextLengthBounds);
        this._setupCharCounter(COMMENT_TEXT_TARGET, commentTextLengthBounds);
    },
    _assertValidCharacterLengths(flagType: ModFlagRadioType) {
        if (flagType === 'mod-flag') {
            assertValidModFlagTextLength(this.modFlagDetailText.length);
        } else if (flagType === 'plagiarism') {
            assertValidPlagiarismFlagTextLengths(this.plagiarismFlagOriginalSourceText.length, this.plagiarismFlagDetailText.length);
        } else {
            throw new Error('Cannot validate bounds for invalid flag type.');
        }
        if (this.shouldComment === true) {
            assertValidCommentTextLength(this.commentText.length);
        }
    },
    _handleFlag(flagType: ModFlagRadioType, postId: number) {
        switch (flagType) {
            case 'mod-flag':
                return handleNukeAsModFlag(postId, this.modFlagDetailText);
            case 'plagiarism':
                return handleNukeAsPlagiarism(postId, this.plagiarismFlagOriginalSourceText, this.plagiarismFlagDetailText);
            default:
                throw new Error('Cannot run flag operation for invalid flag type');
        }
    },
    async HANDLE_NUKE_SUBMIT_ACTIONS(ev: ActionEvent) {
        ev.preventDefault();
        const jSubmitButton = $(this[FORM_SUBMIT_BUTTON_TARGET]);
        jSubmitButton
            .prop('disabled', true)
            .addClass('is-loading');
        const {postId} = ev.params;
        const flagType = this.getFlagType(postId);
        try {
            this._assertValidCharacterLengths(flagType);
            await this._handleFlag(flagType, postId);
            if (this.shouldComment) {
                await addComment(postId, this.commentText);
            }
            window.location.reload();
        } catch (e) {
            StackExchange.helpers.showToast(e.message, {type: 'danger'});
            jSubmitButton
                .prop('disabled', false)
                .removeClass('is-loading');
        }
    },
    HANDLE_CANCEL_ACTION(ev: ActionEvent) {
        ev.preventDefault();
        const {postId} = ev.params;
        removeModalFromDOM(getModalId(postId));
    },
    HANDLE_UPDATE_COMMENT_CONTROL_FIELD(ev: ActionEvent) {
        ev.preventDefault();
        this._setupCommentUI((<HTMLInputElement>ev.target).checked);
    },
    HANDLE_UPDATE_FLAG_TYPE_SELECTION(ev: ActionEvent) {
        ev.preventDefault();
        this._setupFlagUI((<HTMLInputElement>ev.target).value as ModFlagRadioType, '');
    },
    HANDLE_SAVE_CONFIG(ev: ActionEvent) {
        ev.preventDefault();

        const {postId} = ev.params;
        const flagType = this.getFlagType(postId);
        const shouldComment = this.shouldComment;

        const currentConfig: FlagTemplateConfig = {
            flagType: flagType,
            flagDetailTemplate: this._getRelevantDetailText(flagType),
            enableComment: shouldComment,
            commentTextTemplate: shouldComment ? this.commentText : ''
        };
        GM_setValue(gmConfigKey, JSON.stringify(currentConfig));
        StackExchange.helpers.showToast('Successfully saved the current configuration. The form will now open in this state until updated or wiped.', {type: 'success'});
    },
    HANDLE_CLEAR_CONFIG(ev: ActionEvent) {
        ev.preventDefault();
        GM_deleteValue(gmConfigKey);

        StackExchange.helpers.showToast('The saved configuration has been wiped. The form will now open in the default state until a new configuration is saved.', {type: 'info'});
        // Set up from defaults
        const defaultConfig: FlagTemplateConfig = JSON.parse(defaultFlagTemplateConfig);
        this._setupFlagUI(defaultConfig.flagType, defaultConfig.flagDetailTemplate);
        this._setupCommentUI(defaultConfig.enableComment, defaultConfig.commentTextTemplate);
    }
};


async function handleNukeAsModFlag(postId: number, otherText: string) {
    const flagFetch = await flagInNeedOfModeratorIntervention(postId, otherText);
    if (!flagFetch.Success) {
        throw new Error(flagFetch.Message);
    }
    const deleteFetch = await deletePost(postId);
    if (deleteFetch.status !== 200) {
        throw new Error('Something went wrong when deleting the post!');
    }
}

async function handleNukeAsPlagiarism(postId: number, originalSource: string, detailText: string) {
    const flagFetch = await flagPlagiarizedContent(postId, originalSource, detailText);
    if (!flagFetch.Success) {
        throw new Error(flagFetch.Message);
    }
    const deleteFetch = await deleteAsPlagiarism(postId);
    if (deleteFetch.status !== 200) {
        throw new Error('Something went wrong when deleting the post "as plagiarism"!');
    }
}