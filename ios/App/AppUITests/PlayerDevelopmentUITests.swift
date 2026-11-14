import XCTest

final class PlayerDevelopmentUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testAppWelcomeHasPrivateLoginAndNoDemo() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.links["Log in to your account"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.links["Try the sample demo"].exists)
        let welcome = XCTAttachment(screenshot: app.screenshot())
        welcome.name = "iPhone-private-app-welcome"
        welcome.lifetime = .keepAlways
        add(welcome)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.links["Log in to your account"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.links["Try the sample demo"].exists)
    }

    func testPrivateLoginAndAppNavigationWithoutSendingCredentials() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.links["Log in to your account"].waitForExistence(timeout: 30))
        app.links["Log in to your account"].tap()
        let closedEntry = app.staticTexts["Private profiles are being connected."]
        if closedEntry.waitForExistence(timeout: 5) {
            XCTAssertTrue(app.staticTexts["Registration is not open yet. No real player information is collected on this screen."].exists)
            XCTAssertFalse(app.textFields.element.exists)
            XCTAssertFalse(app.secureTextFields.element.exists)
            XCTAssertFalse(app.buttons["Sign in securely"].exists)
            XCTAssertFalse(app.links["Try the sample demo"].exists)
            let help = app.links["Sign-in help"]
            XCTAssertTrue(help.exists)
            help.tap()
            XCTAssertTrue(app.staticTexts["Your app, explained."].waitForExistence(timeout: 15))
            return
        }
        let signIn = app.buttons["Sign in securely"]
        for _ in 0..<5 {
            if signIn.exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(signIn.waitForExistence(timeout: 20))
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        let login = XCTAttachment(screenshot: app.screenshot())
        login.name = "iPhone-private-login"
        login.lifetime = .keepAlways
        add(login)
        // No email/password is entered and no Auth request is submitted.
        app.links["Help"].tap()
        XCTAssertTrue(app.staticTexts["Your app, explained."].waitForExistence(timeout: 15))
    }
}
