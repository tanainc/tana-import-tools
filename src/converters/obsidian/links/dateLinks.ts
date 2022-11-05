import moment from 'moment';

export function dateStringToDateUID(displayName: string, dateFormat: string) {
  const date = moment(displayName, dateFormat, true);
  if (date.isValid()) {
    return date.format('MM-DD-YYYY');
  }
  return;
}
