@echo off
title Bar POS - Choix de l'imprimante ticket
cd /d "%~dp0\wamp_deploy" 2>nul || cd /d "%~dp0"
if exist clientwamp.bat (
    call clientwamp.bat --imprimante
) else if exist wamp_deploy\clientwamp.bat (
    call wamp_deploy\clientwamp.bat --imprimante
)
