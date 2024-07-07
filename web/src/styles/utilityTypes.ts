export interface UseStyles<TUseStyles extends () => unknown> {
  classes?: Partial<ReturnType<TUseStyles>>;
}
