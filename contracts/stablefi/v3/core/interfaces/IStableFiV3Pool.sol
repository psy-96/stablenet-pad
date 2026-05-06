// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './pool/IUniswapV3PoolImmutables.sol';
import './pool/IUniswapV3PoolState.sol';
import './pool/IUniswapV3PoolDerivedState.sol';
import './pool/IUniswapV3PoolActions.sol';
import './pool/IUniswapV3PoolOwnerActions.sol';
import './pool/IUniswapV3PoolEvents.sol';

/// @title The interface for a Uniswap V3 Pool
/// @notice A Uniswap pool facilitates swapping and automated market making between any two assets that strictly conform
/// to the ERC20 specification
/// @dev The pool interface is broken up into many smaller pieces
interface IStableFiV3Pool is
    IStableFiV3PoolImmutables,
    IStableFiV3PoolState,
    IStableFiV3PoolDerivedState,
    IStableFiV3PoolActions,
    IStableFiV3PoolOwnerActions,
    IStableFiV3PoolEvents
{

}
