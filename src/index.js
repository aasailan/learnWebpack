/*
 * @Author: qiao 
 * @Date: 2018-09-17 15:56:33 
 * @Last Modified by: qiao
 * @Last Modified time: 2019-09-01 20:00:17
 * 测试首页
 */

import { sayHi } from './a';
// import sc from './img/sc.png';
const asyncModule = () => import('./c');

sayHi();

// console.log(sc);

asyncModule().then(module => console.log(module));