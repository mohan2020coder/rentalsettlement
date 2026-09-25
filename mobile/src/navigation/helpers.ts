import { CommonActions } from '@react-navigation/native';

type Dispatchable = { dispatch: (action: CommonActions.Action) => void };

export function openTabScreen(
  navigation: Dispatchable,
  tab: string,
  screen: string,
  params?: object,
) {
  navigation.dispatch(CommonActions.navigate(tab, { screen, params }));
}