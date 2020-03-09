
function getString(value : number, digit : number) : string {
	const valueStr = value.toString();
	const length = valueStr.length;
	if(length >= digit) { return valueStr; }
	return '0'.repeat(digit - length) + valueStr;
}

export function getTimestamp() : number {
	return new Date().getTime();
}

export function getTimeDetail() : string {
	const date = new Date();
	const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minutes = date.getMinutes();
	const seconds = date.getSeconds();
	const milliseconds = date.getMilliseconds();
    return `${year}/${getString(month, 2)}/${getString(day, 2)} ${getString(hour, 2)}:${getString(minutes, 2)}:${getString(seconds, 2)}(${getString(milliseconds, 3)})`;
}
