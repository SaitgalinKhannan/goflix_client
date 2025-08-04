import { TorrentConvertingState, TorrentState } from '$lib/types';

export function stateToString(state: number): TorrentState {
	switch (state) {
		case 0:
			return TorrentState.Downloading;
		case 1:
			return TorrentState.Queued;
		case 2:
			return TorrentState.Completed;
		case 3:
			return TorrentState.Paused;
		default:
			return TorrentState.Downloading;
	}
}

export function convertingStateToString(state: number): TorrentConvertingState {
	switch (state) {
		case 0:
			return TorrentConvertingState.NotConverted;
		case 1:
			return TorrentConvertingState.ConvertingQueued;
		case 2:
			return TorrentConvertingState.Converting;
		case 3:
			return TorrentConvertingState.Converted;
		case 4:
			return TorrentConvertingState.ConvertingError;
		default:
			return TorrentConvertingState.NotConverted;
	}
}