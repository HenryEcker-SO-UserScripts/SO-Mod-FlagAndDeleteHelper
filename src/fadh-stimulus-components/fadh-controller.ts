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
import {
    disableSubmitButtonAndToastErrors,
    removeModalFromDOM
} from 'se-ts-userscript-utilities/StacksHelpers/StacksModal';
import {getModalId, type ModFlagRadioType} from '../Globals';
import {type ActionEvent} from '@hotwired/stimulus';
import {addComment} from 'se-ts-userscript-utilities/Comments/Comments';
import {configureCharCounter} from 'se-ts-userscript-utilities/StacksHelpers/StacksCharCounter';


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
            fadhHandlePostFormHidesParam,
            fadhHandlePostFormShowsParam,
            fadhHandlePostFormTextareaParam,
        } = $(this[radioTarget]).data();
        this._hideTargetDiv(`${fadhHandlePostFormHidesParam}Target`);
        this._showTargetDiv(`${fadhHandlePostFormShowsParam}Target`);
        $(this[`${fadhHandlePostFormTextareaParam}Target`])
            .val(baseDetailText ?? '')
            .trigger('charCounterUpdate');
    },
    _setupCommentUI(shouldComment: boolean, baseCommentText?: string) {
        this[ENABLE_COMMENT_TOGGLE_TARGET].checked = shouldComment;
        if (shouldComment) {
            this._showTargetDiv(COMMENT_CONTROL_FIELDS_TARGET);
            $(this[COMMENT_TEXT_TARGET])
                .val(baseCommentText ?? '')
                .trigger('charCounterUpdate');
        } else {
            this._hideTargetDiv(COMMENT_CONTROL_FIELDS_TARGET);
        }
    },
    connect() {
        const loadedConfig: FlagTemplateConfig = JSON.parse(
            GM_getValue(gmConfigKey, defaultFlagTemplateConfig)
        );
        // Set up char counters (only do this once!!)
        configureCharCounter($(this[PLAGIARISM_FLAG_DETAIL_TEXT_TARGET]), '', plagiarismFlagLengthBounds.explanation);
        configureCharCounter($(this[MOD_FLAG_DETAIL_TEXT_TARGET]), '', modFlagTextLengthBounds);
        configureCharCounter($(this[COMMENT_TEXT_TARGET]), '', commentTextLengthBounds);

        // Do Setups after char counter so the values can be written in after the counters are attached
        this._setupFlagUI(loadedConfig.flagType, loadedConfig.flagDetailTemplate);
        this._setupCommentUI(loadedConfig.enableComment, loadedConfig.commentTextTemplate);
    },
    _assertValidCharacterLengths(flagType: ModFlagRadioType) {
        switch (flagType) {
            case 'mod-flag':
                assertValidModFlagTextLength(this.modFlagDetailText.length);
                break;
            case 'plagiarism':
                assertValidPlagiarismFlagTextLengths(this.plagiarismFlagOriginalSourceText.length, this.plagiarismFlagDetailText.length);
                break;
            default:
                throw new Error('Cannot validate bounds for invalid flag type.');
        }
        if (this.shouldComment === true) {
            assertValidCommentTextLength(this.commentText.length);
        }
    },
    _handleFlag(flagType: ModFlagRadioType, postId: number) {
        switch (flagType) {
            case 'mod-flag':
                return handleDeleteWithModFlag(postId, this.modFlagDetailText);
            case 'plagiarism':
                return handleDeleteAsPlagiarism(postId, this.plagiarismFlagOriginalSourceText, this.plagiarismFlagDetailText);
            default:
                throw new Error('Cannot run flag operation for invalid flag type');
        }
    },
    async HANDLE_SUBMIT_ACTIONS(ev: ActionEvent) {
        await disableSubmitButtonAndToastErrors(
            $(this[FORM_SUBMIT_BUTTON_TARGET]),
            async () => {
                ev.preventDefault();
                const {postId} = ev.params;
                const flagType = this.getFlagType(postId);
                this._assertValidCharacterLengths(flagType);
                await this._handleFlag(flagType, postId);
                if (this.shouldComment) {
                    await addComment(postId, this.commentText);
                }
                window.location.reload();
            }
        );
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


async function handleDeleteWithModFlag(postId: number, otherText: string) {
    const flagFetch = await flagInNeedOfModeratorIntervention(postId, otherText);
    if (!flagFetch.Success) {
        throw new Error(flagFetch.Message);
    }
    const deleteFetch = await deletePost(postId);
    if (!deleteFetch.Success) {
        throw new Error(deleteFetch.Message);
    }
}

async function handleDeleteAsPlagiarism(postId: number, originalSource: string, detailText: string) {
    const flagFetch = await flagPlagiarizedContent(postId, originalSource, detailText);
    if (!flagFetch.Success) {
        throw new Error(flagFetch.Message);
    }
    const deleteFetch = await deleteAsPlagiarism(postId);
    if (!deleteFetch.success) {
        throw new Error(deleteFetch.message);
    }
}